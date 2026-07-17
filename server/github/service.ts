import { and, eq } from 'drizzle-orm'
import * as v from 'valibot'
import { githubSnapshots, githubWindows } from '../database/schema.ts'
import type { Database } from '../database/index.ts'
import { fetchGitHubGraphql, type FetchGitHubGraphql } from '../api/githubApi.ts'
import { publicLog } from '../public-logs.ts'
import type { ShutdownScope } from '../utils/shutdown.ts'
import {
	buildContributionsResponse,
	fetchContributionWindow,
} from './contributions.ts'
import { GitHubResourceLimitError } from './errors.ts'
import {
	buildRepositoriesResponse,
	fetchContributionYears,
	fetchRepositoryWindow,
} from './repositories.ts'
import {
	contributionDaysSchema,
	contributionsResponseSchema,
	repositoriesResponseSchema,
	repositoryWindowSchema,
	type GitHubContributionsResponse,
	type GitHubResource,
	type GitHubRepositoriesResponse,
	type GitHubService,
} from './types.ts'
import {
	createHalfYearWindows,
	getContributionCalendarStart,
	splitDateWindow,
	toDateString,
	type DateWindow,
} from './windows.ts'

const GITHUB_LOGIN = 'sheraff'
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const HISTORICAL_WINDOW_TTL_MS = 90 * ONE_DAY_MS
const REFRESH_RETRY_MS = 5 * 60 * 1000

type WindowRow = {
	state: 'ready' | 'split'
	payload: unknown
	expiresAt: number
}

type WindowStore = {
	get: (window: DateWindow) => WindowRow | undefined
	save: (window: DateWindow, row: WindowRow) => void
}

type ManagedResource<T> = {
	get: () => Promise<T>
	stop: () => void
}

type GitHubSnapshot = GitHubContributionsResponse | GitHubRepositoriesResponse

export type ManagedGitHubService = GitHubService & {
	shutdownScope: ShutdownScope
}

export function createGitHubService(
	db: Database,
	parentScope: ShutdownScope,
	options: {
		fetchGraphql?: FetchGitHubGraphql
		now?: () => Date
	} = {},
): ManagedGitHubService {
	const fetchGraphql = options.fetchGraphql ?? fetchGitHubGraphql
	const now = options.now ?? (() => new Date())
	const abortController = new AbortController()
	const pending = new Set<Promise<unknown>>()
	const resources: ManagedResource<unknown>[] = []
	let closing = false

	const shutdownScope = parentScope.child('github service', {
		close: async ({ childrenClosed }) => {
			closing = true
			for (const resource of resources) resource.stop()
			await childrenClosed
			abortController.abort(new Error('GitHub service is shutting down'))
			await Promise.allSettled(pending)
			shutdownScope.done()
		},
		force: () => abortController.abort(new Error('GitHub service shutdown deadline exceeded')),
	})

	const contributionStore = createWindowStore('contributions')
	const repositoryStore = createWindowStore('repositories')

	const contributions = createManagedResource(
		'contributions',
		contributionsResponseSchema,
		async () => {
			publicLog('[data] fetching github activity')
			const currentDate = now()
			const fromDate = getContributionCalendarStart(currentDate)
			const toDate = toDateString(currentDate)
			const roots = createHalfYearWindows(fromDate, toDate)
			const windows = (await allSettledOrThrow(roots.map((window) => loadWindow(
				window,
				contributionStore,
				contributionDaysSchema,
				(range) => fetchContributionWindow(fetchGraphql, GITHUB_LOGIN, range, abortController.signal),
				currentDate,
			)))).flat()
			return buildContributionsResponse(windows, fromDate, toDate)
		},
	)

	const repositories = createManagedResource(
		'repositories',
		repositoriesResponseSchema,
		async () => {
			publicLog('[data] fetching github contributions')
			const currentDate = now()
			const years = await fetchContributionYears(fetchGraphql, GITHUB_LOGIN, abortController.signal)
			const currentYear = currentDate.getUTCFullYear()
			const roots = years
				.filter((year) => year <= currentYear)
				.flatMap((year) => createHalfYearWindows(
					`${year}-01-01`,
					year === currentYear ? toDateString(currentDate) : `${year}-12-31`,
				))
			const windows = (await allSettledOrThrow(roots.map((window) => loadWindow(
				window,
				repositoryStore,
				repositoryWindowSchema,
				(range) => fetchRepositoryWindow(fetchGraphql, GITHUB_LOGIN, range, abortController.signal),
				currentDate,
			)))).flat()
			return buildRepositoriesResponse(windows)
		},
	)

	resources.push(contributions, repositories)

	return {
		shutdownScope,
		getContributions: contributions.get,
		getRepositories: repositories.get,
	}

	function createWindowStore(resource: GitHubResource): WindowStore {
		return {
			get(window) {
				return db.select({
					state: githubWindows.state,
					payload: githubWindows.payload,
					expiresAt: githubWindows.expiresAt,
				}).from(githubWindows).where(and(
					eq(githubWindows.resource, resource),
					eq(githubWindows.login, GITHUB_LOGIN),
					eq(githubWindows.fromDate, window.fromDate),
					eq(githubWindows.toDate, window.toDate),
				)).get()
			},
			save(window, row) {
				db.insert(githubWindows).values({
					resource,
					login: GITHUB_LOGIN,
					fromDate: window.fromDate,
					toDate: window.toDate,
					...row,
				}).onConflictDoUpdate({
					target: [
						githubWindows.resource,
						githubWindows.login,
						githubWindows.fromDate,
						githubWindows.toDate,
					],
					set: row,
				}).run()
			},
		}
	}

	function createManagedResource<T extends GitHubSnapshot>(
		resource: GitHubResource,
		schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
		refresh: () => Promise<T>,
	): ManagedResource<T> {
		const snapshot = db.select({
			payload: githubSnapshots.payload,
			updatedAt: githubSnapshots.updatedAt,
		}).from(githubSnapshots).where(and(
			eq(githubSnapshots.resource, resource),
			eq(githubSnapshots.login, GITHUB_LOGIN),
		)).get()
		const parsedSnapshot = snapshot && v.safeParse(schema, snapshot.payload)
		let data: T | undefined
		let updatedAt = 0
		if (parsedSnapshot?.success && snapshot) {
			data = parsedSnapshot.output
			updatedAt = snapshot.updatedAt
		}
		let refreshPromise: Promise<T> | undefined
		let refreshTimeout: NodeJS.Timeout | undefined

		function schedule(delayMs: number) {
			if (closing) return
			if (refreshTimeout) clearTimeout(refreshTimeout)
			refreshTimeout = setTimeout(() => {
				void startRefresh().catch(() => undefined)
			}, Math.max(0, delayMs))
			refreshTimeout.unref()
		}

		async function startRefresh() {
			if (refreshPromise) return refreshPromise
			if (closing) {
				if (data) return data
				throw new Error('GitHub service is shutting down')
			}

			const promise = refresh().then((value) => {
				const timestamp = now().getTime()
				db.insert(githubSnapshots).values({
					resource,
					login: GITHUB_LOGIN,
					payload: value,
					updatedAt: timestamp,
				}).onConflictDoUpdate({
					target: [githubSnapshots.resource, githubSnapshots.login],
					set: { payload: value, updatedAt: timestamp },
				}).run()
				data = value
				updatedAt = timestamp
				schedule(ONE_DAY_MS)
				return value
			}).catch((error) => {
				if (!closing) {
					console.warn(`[data] github ${resource} refresh failed`, error)
					publicLog(`[WARN] github ${resource} refresh failed`)
					schedule(REFRESH_RETRY_MS)
				}
				throw error
			})

			refreshPromise = promise
			pending.add(promise)
			promise.then(
				() => pending.delete(promise),
				() => pending.delete(promise),
			)

			try {
				return await promise
			} finally {
				if (refreshPromise === promise) refreshPromise = undefined
			}
		}

		async function get() {
			if (!data) return startRefresh()
			if (updatedAt + ONE_DAY_MS <= now().getTime()) {
				void startRefresh().catch(() => undefined)
			}
			return data
		}

		if (data) schedule(updatedAt + ONE_DAY_MS - now().getTime())

		return {
			get,
			stop() {
				if (refreshTimeout) clearTimeout(refreshTimeout)
			},
		}
	}
}

async function loadWindow<T>(
	window: DateWindow,
	store: WindowStore,
	schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
	fetchWindow: (window: DateWindow) => Promise<T>,
	now: Date,
): Promise<T[]> {
	const row = store.get(window)
	const parsedPayload = row?.payload ? v.safeParse(schema, row.payload) : undefined
	const payload = parsedPayload?.success ? parsedPayload.output : undefined
	const nowMs = now.getTime()

	if (row?.state === 'split' && row.expiresAt > nowMs) {
		const children = splitDateWindow(window)
		if (!children) throw new GitHubResourceLimitError()
		return (await allSettledOrThrow(children.map((child) =>
			loadWindow(child, store, schema, fetchWindow, now),
		))).flat()
	}

	if (row?.state === 'ready' && payload && row.expiresAt > nowMs) {
		return [payload]
	}

	try {
		const freshPayload = await fetchWindow(window)
		store.save(window, {
			state: 'ready',
			payload: freshPayload,
			expiresAt: nowMs + getWindowTtl(window, now),
		})
		return [freshPayload]
	} catch (error) {
		if (error instanceof GitHubResourceLimitError) {
			const children = splitDateWindow(window)
			if (children) {
				store.save(window, {
					state: 'split',
					payload: null,
					expiresAt: nowMs + getWindowTtl(window, now),
				})
				return (await allSettledOrThrow(children.map((child) =>
					loadWindow(child, store, schema, fetchWindow, now),
				))).flat()
			}
		}

		throw error
	}
}

function getWindowTtl(window: DateWindow, now: Date) {
	return window.toDate < toDateString(now) ? HISTORICAL_WINDOW_TTL_MS : ONE_DAY_MS
}

async function allSettledOrThrow<T>(promises: Promise<T>[]) {
	const results = await Promise.allSettled(promises)
	const values: T[] = []
	let failed = false
	let failure: unknown
	for (const result of results) {
		if (result.status === 'fulfilled') values.push(result.value)
		else if (!failed) {
			failed = true
			failure = result.reason
		}
	}
	if (failed) throw failure
	return values
}
