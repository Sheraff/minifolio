import * as v from 'valibot'
import type { FetchGitHubGraphql } from '../api/githubApi.ts'
import { parseGraphQLResponse } from './errors.ts'
import type { GitHubContributionDay, GitHubContributionsResponse } from './types.ts'
import { toGraphqlRange, type DateWindow } from './windows.ts'

const contributionsQuery = `
	query Contributions($login: String!, $from: DateTime!, $to: DateTime!) {
		user(login: $login) {
			contributionsCollection(from: $from, to: $to) {
				contributionCalendar {
					weeks {
						contributionDays {
							date
							contributionCount
						}
					}
				}
			}
		}
	}
`

const githubContributionsResponseSchema = v.object({
	data: v.optional(v.object({
		user: v.nullable(v.object({
			contributionsCollection: v.object({
				contributionCalendar: v.object({
					weeks: v.array(v.object({
						contributionDays: v.array(v.object({
							date: v.string(),
							contributionCount: v.number(),
						})),
					})),
				}),
			}),
		})),
	})),
})

export async function fetchContributionWindow(
	fetchGraphql: FetchGitHubGraphql,
	login: string,
	window: DateWindow,
	signal: AbortSignal,
): Promise<GitHubContributionDay[]> {
	const json = parseGraphQLResponse(
		githubContributionsResponseSchema,
		await fetchGraphql(contributionsQuery, {
			login,
			...toGraphqlRange(window),
		}, signal),
	)

	const calendar = json.data?.user?.contributionsCollection.contributionCalendar
	if (!calendar) {
		throw new Error(`GitHub user not found: ${login}`)
	}

	return calendar.weeks.flatMap((week) => week.contributionDays)
		.filter((day) => day.date >= window.fromDate && day.date <= window.toDate)
		.map((day) => ({
			date: day.date,
			count: day.contributionCount,
		}))
}

export function buildContributionsResponse(
	windows: GitHubContributionDay[][],
	fromDate: string,
	toDate: string,
): GitHubContributionsResponse {
	const counts = new Map<string, number>()

	for (const days of windows) {
		for (const day of days) {
			if (day.date >= fromDate && day.date <= toDate) {
				counts.set(day.date, day.count)
			}
		}
	}

	const maxCount = Math.max(0, ...counts.values())
	const levelSize = Math.ceil(maxCount / 5)
	const contributions = Array.from(counts, ([date, count]) => ({
		date,
		count,
		level: count === 0 ? 0 : Math.min(4, Math.ceil(count / levelSize)),
	})).sort((left, right) => left.date.localeCompare(right.date))

	return {
		total: {
			lastYear: contributions.reduce((total, day) => total + day.count, 0),
		},
		contributions,
	}
}
