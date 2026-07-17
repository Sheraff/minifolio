import { expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchGitHubGraphql: vi.fn(),
}))

vi.mock('./githubApi.ts', () => ({
	fetchGitHubGraphql: mocks.fetchGitHubGraphql,
	GITHUB_LOGIN: 'sheraff',
	GITHUB_LOGIN_NORMALIZED: 'sheraff',
	ONE_DAY_MS: 24 * 60 * 60 * 1000,
}))

import { fetchContributedRepositories } from './githubRepositories.ts'

test('fetches repository contributions in half-year ranges and combines them', async () => {
	mocks.fetchGitHubGraphql.mockImplementation(async (query, variables) => {
		if ((query as string).includes('ContributionYears')) {
			return {
				data: {
					user: {
						contributionsCollection: { contributionYears: [2025] },
					},
				},
			}
		}

		const { from } = variables as { from: string }
		const secondHalf = from.startsWith('2025-07')
		const repository = {
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
		}
		const contributions = {
			totalCount: secondHalf ? 3 : 2,
			nodes: [{ occurredAt: secondHalf ? '2025-08-01T00:00:00Z' : '2025-02-01T00:00:00Z' }],
		}

		return {
			data: {
				user: {
					contributionsCollection: {
						commitContributionsByRepository: [{ repository, contributions }],
						issueContributionsByRepository: [],
						pullRequestContributionsByRepository: [],
						pullRequestReviewContributionsByRepository: [],
					},
				},
			},
		}
	})

	const result = await fetchContributedRepositories()
	const sliceCalls = mocks.fetchGitHubGraphql.mock.calls.slice(1)

	expect(sliceCalls).toHaveLength(2)
	expect(sliceCalls.map((call) => call[1])).toEqual([
		{
			login: 'sheraff',
			from: '2025-01-01T00:00:00Z',
			to: '2025-06-30T23:59:59Z',
		},
		{
			login: 'sheraff',
			from: '2025-07-01T00:00:00Z',
			to: '2025-12-31T23:59:59Z',
		},
	])
	expect(result.repositories).toEqual([{
		name: 'example',
		nameWithOwner: 'someone/example',
		url: 'https://github.com/someone/example',
		description: 'Example repository',
		owner: {
			login: 'someone',
			avatarUrl: 'https://avatars.githubusercontent.com/u/1',
		},
		imageUrl: 'https://avatars.githubusercontent.com/u/1',
		imageSource: 'owner',
		contributionCount: 5,
		lastContributedAt: '2025-08-01T00:00:00Z',
		lastPullRequest: null,
	}])
})
