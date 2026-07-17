import { expect, test, vi } from 'vitest'

import { createGitHubGraphqlClient } from './githubApi.ts'

test('retries a secondary rate limit after the requested delay', async () => {
	const fetchMock = vi.fn()
		.mockResolvedValueOnce(new Response(null, {
			status: 403,
			headers: { 'retry-after': '0' },
		}))
		.mockResolvedValueOnce(new Response(JSON.stringify({ data: { viewer: { login: 'Sheraff' } } })))
	const { fetchGitHubGraphql } = createTestClient(fetchMock)

	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).resolves.toEqual({
		data: { viewer: { login: 'Sheraff' } },
	})
	expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('retries rate limits returned in a successful GraphQL response', async () => {
	const fetchMock = vi.fn()
		.mockResolvedValueOnce(new Response(JSON.stringify({
			errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
		}), {
			headers: { 'retry-after': '0' },
		}))
		.mockResolvedValueOnce(new Response(JSON.stringify({ data: { viewer: { login: 'Sheraff' } } })))
	const { fetchGitHubGraphql } = createTestClient(fetchMock)

	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).resolves.toEqual({
		data: { viewer: { login: 'Sheraff' } },
	})
	expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('retries a headerless secondary rate limit with the default delay', async () => {
	const fetchMock = vi.fn()
		.mockResolvedValueOnce(new Response(
			JSON.stringify({ message: 'You have exceeded a secondary rate limit.' }),
			{ status: 403 },
		))
		.mockResolvedValueOnce(new Response(JSON.stringify({ data: { viewer: { login: 'Sheraff' } } })))
	const { fetchGitHubGraphql, wait } = createTestClient(fetchMock)

	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).resolves.toEqual({
		data: { viewer: { login: 'Sheraff' } },
	})
	expect(fetchMock).toHaveBeenCalledTimes(2)
	expect(wait).toHaveBeenCalledWith(60_000, undefined)
})

test('retries a too-many-requests response', async () => {
	const fetchMock = vi.fn()
		.mockResolvedValueOnce(new Response(null, {
			status: 429,
			headers: { 'retry-after': '0' },
		}))
		.mockResolvedValueOnce(new Response(JSON.stringify({ data: { viewer: { login: 'Sheraff' } } })))
	const { fetchGitHubGraphql } = createTestClient(fetchMock)

	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).resolves.toEqual({
		data: { viewer: { login: 'Sheraff' } },
	})
	expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('extends the shared cooldown when the retry is also rate limited', async () => {
	const fetchMock = vi.fn()
		.mockResolvedValueOnce(new Response(null, {
			status: 429,
			headers: { 'retry-after': '1' },
		}))
		.mockResolvedValueOnce(new Response(null, {
			status: 429,
			headers: { 'retry-after': '60' },
		}))
		.mockResolvedValueOnce(new Response(JSON.stringify({ data: { viewer: { login: 'Sheraff' } } })))
	const { fetchGitHubGraphql, wait } = createTestClient(fetchMock)

	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).rejects.toThrow(
		'GitHub API request failed with 429',
	)
	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).resolves.toEqual({
		data: { viewer: { login: 'Sheraff' } },
	})
	expect(wait.mock.calls.map(([delayMs]) => delayMs)).toEqual([1_000, 60_000])
})

test('does not retry an unrelated forbidden response', async () => {
	const fetchMock = vi.fn().mockResolvedValue(new Response(
		JSON.stringify({ message: 'Resource not accessible by personal access token' }),
		{ status: 403 },
	))
	const { fetchGitHubGraphql } = createTestClient(fetchMock)

	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).rejects.toThrow(
		'Resource not accessible by personal access token',
	)
	expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('includes GitHub error details and rate-limit metadata', async () => {
	const fetchMock = vi.fn().mockImplementation(async () => new Response(
		JSON.stringify({ message: 'You have exceeded a secondary rate limit.' }),
		{
			status: 403,
			headers: {
				'retry-after': '0',
				'x-github-request-id': 'request-123',
				'x-ratelimit-remaining': '4780',
				'x-ratelimit-reset': '1784321317',
			},
		},
	))
	const { fetchGitHubGraphql } = createTestClient(fetchMock)

	await expect(fetchGitHubGraphql('query { viewer { login } }', {})).rejects.toThrow(
		'GitHub API request failed with 403: You have exceeded a secondary rate limit. '
		+ '(retry-after=0, remaining=4780, reset=1784321317, request-id=request-123)',
	)
	expect(fetchMock).toHaveBeenCalledTimes(2)
})

function createTestClient(fetchMock: ReturnType<typeof vi.fn>) {
	let now = 0
	const wait = vi.fn(async (delayMs: number) => {
		now += delayMs
	})
	return {
		fetchGitHubGraphql: createGitHubGraphqlClient({
			fetch: fetchMock as typeof fetch,
			getToken: async () => 'test-token',
			now: () => now,
			wait,
		}),
		wait,
	}
}
