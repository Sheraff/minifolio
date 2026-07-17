import { expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchGitHubGraphql: vi.fn(),
}))

vi.mock('./githubApi.ts', () => ({
	fetchGitHubGraphql: mocks.fetchGitHubGraphql,
	GITHUB_LOGIN: 'sheraff',
	ONE_DAY_MS: 24 * 60 * 60 * 1000,
}))

import { fetchGitHubContributions } from './github.ts'

test('fetches the contribution calendar in two ranges and merges its scale', async () => {
	mocks.fetchGitHubGraphql.mockImplementation(async (_query, variables) => {
		const { from } = variables as { from: string }
		const firstDate = from.slice(0, 10)
		const nextDate = new Date(`${firstDate}T00:00:00Z`)
		nextDate.setUTCDate(nextDate.getUTCDate() + 1)
		const isFirstRange = mocks.fetchGitHubGraphql.mock.calls.length === 1

		return {
			data: {
				user: {
					contributionsCollection: {
						contributionCalendar: {
							weeks: [{
								contributionDays: isFirstRange
									? [
										{ date: firstDate, contributionCount: 15 },
										{ date: nextDate.toISOString().slice(0, 10), contributionCount: 16 },
									]
									: [{ date: firstDate, contributionCount: 74 }],
							}],
						},
					},
				},
			},
		}
	})

	const result = await fetchGitHubContributions()
	const firstVariables = mocks.fetchGitHubGraphql.mock.calls[0][1] as { from: string; to: string }
	const secondVariables = mocks.fetchGitHubGraphql.mock.calls[1][1] as { from: string; to: string }

	expect(mocks.fetchGitHubGraphql).toHaveBeenCalledTimes(2)
	expect(new Date(firstVariables.to).getTime() + 1).toBe(new Date(secondVariables.from).getTime())
	expect(result).toEqual({
		total: { lastYear: 105 },
		contributions: [
			{ date: firstVariables.from.slice(0, 10), count: 15, level: 1 },
			{
				date: new Date(new Date(firstVariables.from).getTime() + 24 * 60 * 60 * 1000)
					.toISOString().slice(0, 10),
				count: 16,
				level: 2,
			},
			{ date: secondVariables.from.slice(0, 10), count: 74, level: 4 },
		],
	})
})
