import { setTimeout as delay } from 'node:timers/promises'
import { getGitHubToken } from './getGithubToken.ts'

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql'
const GITHUB_MAX_CONCURRENT_REQUESTS = 3
const DEFAULT_RATE_LIMIT_RETRY_MS = 60 * 1000

type RequestWaiter = {
	resolve: () => void
	reject: (error: unknown) => void
	signal?: AbortSignal
	onAbort?: () => void
}

type GitHubGraphqlClientOptions = {
	fetch?: typeof fetch
	getToken?: () => Promise<string>
	now?: () => number
	wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>
}

export type FetchGitHubGraphql = (
	query: string,
	variables: Record<string, unknown>,
	signal?: AbortSignal,
) => Promise<unknown>

export function createGitHubGraphqlClient(
	options: GitHubGraphqlClientOptions = {},
): FetchGitHubGraphql {
	const fetchImpl = options.fetch ?? globalThis.fetch
	const getToken = options.getToken ?? getGitHubToken
	const now = options.now ?? Date.now
	const wait = options.wait ?? ((delayMs, signal) =>
		delay(delayMs, undefined, { signal }).then(() => undefined)
	)
	const requestWaiters: RequestWaiter[] = []
	let activeRequestCount = 0
	let cooldownUntil = 0

	return async function fetchGitHubGraphql(query, variables, signal) {
		const token = await getToken()
		await acquireRequestSlot(signal)

		try {
			for (let attempt = 0; attempt < 2; attempt++) {
				await waitForCooldown(signal)
				const response = await fetchImpl(GITHUB_GRAPHQL_API, {
					method: 'POST',
					headers: {
						authorization: `Bearer ${token}`,
						'content-type': 'application/json',
						'user-agent': 'minifolio',
					},
					body: JSON.stringify({ query, variables }),
					signal,
				})
				const body: unknown = await response.json().catch((error) => {
					if (response.ok) throw error
					return null
				})
				const rateLimitDelay = getRateLimitDelayMs(response, now())
				const rateLimited = response.status === 429
					|| hasRateLimitError(body)
					|| (response.status === 403 && rateLimitDelay !== null)
				if (rateLimited) {
					startCooldown(rateLimitDelay ?? DEFAULT_RATE_LIMIT_RETRY_MS)
					if (attempt === 0) continue
				}

				if (response.ok) return body
				throw createGitHubApiError(response, body)
			}
		} finally {
			releaseRequestSlot()
		}

		throw new Error('GitHub API request failed after retry')
	}

	function acquireRequestSlot(signal?: AbortSignal) {
		if (signal?.aborted) return Promise.reject(signal.reason)
		if (activeRequestCount < GITHUB_MAX_CONCURRENT_REQUESTS) {
			activeRequestCount++
			return Promise.resolve()
		}

		return new Promise<void>((resolve, reject) => {
			const waiter: RequestWaiter = { resolve, reject, signal }
			if (signal) {
				waiter.onAbort = () => {
					const index = requestWaiters.indexOf(waiter)
					if (index >= 0) requestWaiters.splice(index, 1)
					reject(signal.reason)
				}
				signal.addEventListener('abort', waiter.onAbort, { once: true })
			}
			requestWaiters.push(waiter)
		})
	}

	function releaseRequestSlot() {
		const next = requestWaiters.shift()
		if (next) {
			if (next.signal && next.onAbort) {
				next.signal.removeEventListener('abort', next.onAbort)
			}
			next.resolve()
		} else {
			activeRequestCount--
		}
	}

	function startCooldown(delayMs: number) {
		cooldownUntil = Math.max(cooldownUntil, now() + delayMs)
	}

	async function waitForCooldown(signal?: AbortSignal) {
		while (cooldownUntil > now()) {
			await wait(cooldownUntil - now(), signal)
		}
	}
}

export const fetchGitHubGraphql = createGitHubGraphqlClient()

function getRetryAfterMs(response: Response) {
	const retryAfter = response.headers.get('retry-after')
	if (!retryAfter) return null

	const seconds = Number(retryAfter)
	return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null
}

function getRateLimitDelayMs(response: Response, now: number) {
	const retryAfter = getRetryAfterMs(response)
	if (retryAfter !== null) return retryAfter

	const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000
	if (response.headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(reset) && reset > now) {
		return reset - now
	}
	return null
}

function hasRateLimitError(body: unknown) {
	if (!body || typeof body !== 'object') return false
	if ('message' in body && typeof body.message === 'string' && /rate limit/i.test(body.message)) {
		return true
	}
	if (!('errors' in body) || !Array.isArray(body.errors)) return false

	return body.errors.some((error) => {
		if (!error || typeof error !== 'object') return false
		const type = 'type' in error ? error.type : undefined
		const message = 'message' in error ? error.message : undefined
		return type === 'RATE_LIMITED' || (typeof message === 'string' && /rate limit/i.test(message))
	})
}

function createGitHubApiError(response: Response, body: unknown) {
	const message = body && typeof body === 'object' && 'message' in body
		? body.message
		: undefined
	const detail = typeof message === 'string' ? `: ${message}` : ''
	const metadata = [
		formatResponseMetadata('retry-after', response.headers.get('retry-after')),
		formatResponseMetadata('remaining', response.headers.get('x-ratelimit-remaining')),
		formatResponseMetadata('reset', response.headers.get('x-ratelimit-reset')),
		formatResponseMetadata('request-id', response.headers.get('x-github-request-id')),
	].filter(Boolean).join(', ')
	const metadataSuffix = metadata ? ` (${metadata})` : ''

	return new Error(`GitHub API request failed with ${response.status}${detail}${metadataSuffix}`)
}

function formatResponseMetadata(label: string, value: string | null) {
	return value ? `${label}=${value}` : ''
}
