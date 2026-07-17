import { and, eq } from 'drizzle-orm'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, vi } from 'vitest'
import { createDatabase } from '../database/index.ts'
import { githubSnapshots, githubWindows } from '../database/schema.ts'
import { ShutdownScope } from '../utils/shutdown.ts'
import type { FetchGitHubGraphql } from '../api/githubApi.ts'
import { createGitHubService } from './service.ts'
import type { GitHubContributionsResponse } from './types.ts'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))
const now = () => new Date('2026-07-17T12:00:00Z')

test('serves a persisted contribution snapshot after service restart', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'minifolio-github-test-'))
	const databasePath = join(directory, 'github.sqlite')
	const fetchGraphql = vi.fn<FetchGitHubGraphql>(async (_query, variables) => {
		const { from } = variables as { from: string }
		const days: Record<string, { date: string; count: number }> = {
			'2025-07-01T00:00:00Z': { date: '2025-07-13', count: 10 },
			'2026-01-01T00:00:00Z': { date: '2026-01-01', count: 20 },
			'2026-07-01T00:00:00Z': { date: '2026-07-17', count: 5 },
		}
		const day = days[from]
		if (!day) throw new Error(`Unexpected range: ${from}`)

		return contributionWindowResponse(day)
	})
	let firstResult: GitHubContributionsResponse | undefined

	try {
		const firstDatabase = createDatabase(databasePath, migrationsFolder)
		const firstRoot = new ShutdownScope('first root')
		try {
			const firstService = createGitHubService(firstDatabase.db, firstRoot, { fetchGraphql, now })
			firstResult = await firstService.getContributions()
			expect(firstResult.total.lastYear).toBe(35)
			expect(fetchGraphql).toHaveBeenCalledTimes(3)
		} finally {
			await closeScope(firstRoot)
			firstDatabase.close()
		}

		const secondDatabase = createDatabase(databasePath, migrationsFolder)
		const secondRoot = new ShutdownScope('second root')
		const unavailableFetch = vi.fn<FetchGitHubGraphql>(async () => {
			throw new Error('GitHub should not be called')
		})
		try {
			const secondService = createGitHubService(secondDatabase.db, secondRoot, {
				fetchGraphql: unavailableFetch,
				now,
			})

			expect(await secondService.getContributions()).toEqual(firstResult)
			expect(unavailableFetch).not.toHaveBeenCalled()
		} finally {
			await closeScope(secondRoot)
			secondDatabase.close()
		}
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
})

test('does not mark a failed window refresh as a fresh snapshot', async () => {
	const database = createDatabase(':memory:', migrationsFolder)
	let currentDate = new Date('2026-07-17T12:00:00Z')
	const currentNow = () => currentDate
	const fetchGraphql = vi.fn<FetchGitHubGraphql>(async (_query, variables) => {
		const { from } = variables as { from: string }
		return contributionWindowResponse({
			date: from.slice(0, 10),
			count: 1,
		})
	})
	const firstRoot = new ShutdownScope('first root')

	try {
		const firstService = createGitHubService(database.db, firstRoot, {
			fetchGraphql,
			now: currentNow,
		})
		const firstResult = await firstService.getContributions()
		const initialSnapshot = database.db.select({ updatedAt: githubSnapshots.updatedAt })
			.from(githubSnapshots)
			.where(eq(githubSnapshots.resource, 'contributions'))
			.get()
		expect(initialSnapshot?.updatedAt).toBe(currentDate.getTime())
		await closeScope(firstRoot)

		currentDate = new Date('2026-07-18T12:00:01Z')
		const secondRoot = new ShutdownScope('second root')
		const unavailableFetch = vi.fn<FetchGitHubGraphql>(async () => {
			throw new Error('GitHub unavailable')
		})
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		try {
			const secondService = createGitHubService(database.db, secondRoot, {
				fetchGraphql: unavailableFetch,
				now: currentNow,
			})

			expect(await secondService.getContributions()).toEqual(firstResult)
			await vi.waitFor(() => expect(unavailableFetch).toHaveBeenCalledTimes(1))
			const snapshotAfterFailure = database.db.select({ updatedAt: githubSnapshots.updatedAt })
				.from(githubSnapshots)
				.where(eq(githubSnapshots.resource, 'contributions'))
				.get()
			expect(snapshotAfterFailure).toEqual(initialSnapshot)
		} finally {
			warning.mockRestore()
			await closeScope(secondRoot)
		}
	} finally {
		if (!firstRoot.closed) await closeScope(firstRoot)
		database.close()
	}
})

test('persists resource-limit splits and reuses their child windows', async () => {
	const database = createDatabase(':memory:', migrationsFolder)
	const firstRoot = new ShutdownScope('first root')
	let secondRoot: ShutdownScope | undefined
	const fetchGraphql = vi.fn<FetchGitHubGraphql>(async (query, variables) => {
		if (query.includes('ContributionYears')) {
			return contributionYearsResponse([2025])
		}

		const { from, to } = variables as { from: string; to: string }
		if (from === '2025-01-01T00:00:00Z' && to === '2025-06-30T23:59:59Z') {
			return {
				data: { user: null },
				errors: [
					{ message: 'Partial response' },
					{
						type: 'RESOURCE_LIMITS_EXCEEDED',
						message: 'Resource limits for this query exceeded.',
					},
				],
			}
		}

		return repositoryWindowResponse(from)
	})

	try {
		const firstService = createGitHubService(database.db, firstRoot, { fetchGraphql, now })
		const firstResult = await firstService.getRepositories()
		expect(firstResult.repositories[0]?.contributionCount).toBe(3)
		expect(fetchGraphql).toHaveBeenCalledTimes(5)

		const split = database.db.select({ state: githubWindows.state })
			.from(githubWindows)
			.where(and(
				eq(githubWindows.resource, 'repositories'),
				eq(githubWindows.login, 'sheraff'),
				eq(githubWindows.fromDate, '2025-01-01'),
				eq(githubWindows.toDate, '2025-06-30'),
			)).get()
		expect(split?.state).toBe('split')
		await closeScope(firstRoot)

		database.db.delete(githubSnapshots)
			.where(eq(githubSnapshots.resource, 'repositories'))
			.run()

		secondRoot = new ShutdownScope('second root')
		const warmFetch = vi.fn<FetchGitHubGraphql>(async (query) => {
			if (query.includes('ContributionYears')) return contributionYearsResponse([2025])
			throw new Error('Persisted repository windows should be reused')
		})
		const secondService = createGitHubService(database.db, secondRoot, {
			fetchGraphql: warmFetch,
			now,
		})

		expect(await secondService.getRepositories()).toEqual(firstResult)
		expect(warmFetch).toHaveBeenCalledTimes(1)
		await closeScope(secondRoot)
	} finally {
		if (secondRoot && !secondRoot.closed) await closeScope(secondRoot)
		if (!firstRoot.closed) await closeScope(firstRoot)
		database.close()
	}
})

function contributionYearsResponse(years: number[]) {
	return {
		data: {
			user: {
				contributionsCollection: { contributionYears: years },
			},
		},
	}
}

function contributionWindowResponse(day: { date: string; count: number }) {
	return {
		data: {
			user: {
				contributionsCollection: {
					contributionCalendar: {
						weeks: [{ contributionDays: [{
							date: day.date,
							contributionCount: day.count,
						}] }],
					},
				},
			},
		},
	}
}

function repositoryWindowResponse(from: string) {
	return {
		data: {
			user: {
				contributionsCollection: {
					commitContributionsByRepository: [{
						repository: {
							id: 'repository-1',
							name: 'example',
							nameWithOwner: 'someone/example',
							url: 'https://github.com/someone/example',
							description: 'Example repository',
							openGraphImageUrl: null,
							usesCustomOpenGraphImage: false,
							owner: {
								login: 'someone',
								avatarUrl: 'https://avatars.githubusercontent.com/u/1',
							},
						},
						contributions: {
							totalCount: 1,
							nodes: [{ occurredAt: from }],
						},
					}],
					issueContributionsByRepository: [],
					pullRequestContributionsByRepository: [],
					pullRequestReviewContributionsByRepository: [],
				},
			},
		},
	}
}

async function closeScope(scope: ShutdownScope) {
	const deadline = new AbortController()
	await scope.close({
		deadline: deadline.signal,
		childrenClosed: Promise.resolve(),
	})
}
