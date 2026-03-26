import * as v from 'valibot'
import { fetchGitHubGraphql, GITHUB_LOGIN, ONE_DAY_MS } from './githubApi.ts'

const CONTRIBUTION_LEVELS = {
	NONE: 0,
	FIRST_QUARTILE: 1,
	SECOND_QUARTILE: 2,
	THIRD_QUARTILE: 3,
	FOURTH_QUARTILE: 4,
} as const

const contributionsQuery = `
	query Contributions($login: String!) {
		user(login: $login) {
			contributionsCollection {
				contributionCalendar {
					totalContributions
					weeks {
						contributionDays {
							date
							contributionCount
							contributionLevel
						}
					}
				}
			}
		}
	}
`

type GitHubContributionLevel = keyof typeof CONTRIBUTION_LEVELS

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

const githubContributionLevelSchema = v.picklist(
	Object.keys(CONTRIBUTION_LEVELS) as [GitHubContributionLevel, ...GitHubContributionLevel[]],
)

const githubContributionsResponseSchema = v.object({
	data: v.optional(v.object({
		user: v.nullable(v.object({
			contributionsCollection: v.object({
				contributionCalendar: v.object({
					totalContributions: v.number(),
					weeks: v.array(v.object({
						contributionDays: v.array(v.object({
							date: v.string(),
							contributionCount: v.number(),
							contributionLevel: githubContributionLevelSchema,
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

let contributionsCache:
	| {
		data: ContributionsResponse
		expiresAt: number
	}
	| undefined

let contributionsPromise: Promise<ContributionsResponse> | undefined

async function loadGitHubContributions(): Promise<ContributionsResponse> {
	if (contributionsCache && contributionsCache.expiresAt > Date.now()) {
		return contributionsCache.data
	}

	if (contributionsPromise) {
		return contributionsPromise
	}

	contributionsPromise = fetchGitHubContributionsFromApi()

	try {
		const data = await contributionsPromise
		contributionsCache = {
			data,
			expiresAt: Date.now() + ONE_DAY_MS,
		}
		return data
	} finally {
		contributionsPromise = undefined
	}
}

async function fetchGitHubContributionsFromApi(): Promise<ContributionsResponse> {
	const json = v.parse(
		githubContributionsResponseSchema,
		await fetchGitHubGraphql(contributionsQuery, {
			login: GITHUB_LOGIN,
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

	return {
		total: {
			lastYear: contributionCalendar.totalContributions,
		},
		contributions: contributionCalendar.weeks.flatMap((week) =>
			week.contributionDays.map((day) => ({
				date: day.date,
				count: day.contributionCount,
				level: CONTRIBUTION_LEVELS[day.contributionLevel],
			})),
		),
	}
}

export async function fetchGitHubContributions() {
	return loadGitHubContributions()
}
