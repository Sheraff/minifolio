import * as v from 'valibot'
import { fetchGitHubGraphql, GITHUB_LOGIN, ONE_DAY_MS } from './githubApi.ts'
import { publicLog } from '#server/public-logs.ts'
import { createCachedFetcher } from '#server/utils/cache.ts'

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

type ContributionsResponse = {
	total: {
		lastYear: number
	}
	contributions: {
		date: string
		count: number
		level: number
	}[]
}

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
	errors: v.optional(v.array(v.object({
		message: v.string(),
	}))),
})

const loadGitHubContributions = createCachedFetcher<ContributionsResponse>({
	label: 'github activity',
	ttlMs: ONE_DAY_MS,
	fetch: fetchGitHubContributionsFromApi,
})

async function fetchGitHubContributionsFromApi(): Promise<ContributionsResponse> {
	publicLog("[data] fetching github activity")
	const ranges = getContributionDateRanges()
	const calendars = await Promise.all(
		ranges.map(async (range) => {
			const json = v.parse(
				githubContributionsResponseSchema,
				await fetchGitHubGraphql(contributionsQuery, {
					login: GITHUB_LOGIN,
					from: range.from,
					to: range.to,
				}),
			)

			if (json.errors?.length) {
				throw new Error(json.errors[0].message)
			}

			const data = json.data
			if (!data) {
				throw new Error('GitHub API returned no data')
			}

			const contributionCalendar = data.user?.contributionsCollection.contributionCalendar
			if (!contributionCalendar) {
				throw new Error(`GitHub user not found: ${GITHUB_LOGIN}`)
			}

			return contributionCalendar
		}),
	)
	const contributionCounts = new Map<string, number>()

	for (const [index, calendar] of calendars.entries()) {
		const range = ranges[index]
		const firstDate = range.from.slice(0, 10)
		const lastDate = range.to.slice(0, 10)

		for (const week of calendar.weeks) {
			for (const day of week.contributionDays) {
				if (day.date < firstDate || day.date > lastDate) continue
				contributionCounts.set(day.date, day.contributionCount)
			}
		}
	}

	const maxCount = Math.max(0, ...contributionCounts.values())
	// Preserve GitHub's full-calendar color buckets after merging the sliced responses.
	const levelSize = Math.ceil(maxCount / 5)
	const contributions = Array.from(contributionCounts, ([date, count]) => ({
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

function getContributionDateRanges(now = new Date()) {
	const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
	from.setUTCDate(from.getUTCDate() - from.getUTCDay() - 52 * 7)

	const midpoint = new Date(from)
	midpoint.setUTCDate(midpoint.getUTCDate() + 26 * 7)

	return [
		{
			from: from.toISOString(),
			to: new Date(midpoint.getTime() - 1).toISOString(),
		},
		{
			from: midpoint.toISOString(),
			to: now.toISOString(),
		},
	]
}

export async function fetchGitHubContributions() {
	return loadGitHubContributions()
}
