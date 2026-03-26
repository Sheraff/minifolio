import * as v from 'valibot'
import { getGitHubToken } from "./getGithubToken.ts"

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const GITHUB_LOGIN = 'sheraff'
const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql'
const CONTRIBUTION_LEVELS = {
	NONE: 0,
	FIRST_QUARTILE: 1,
	SECOND_QUARTILE: 2,
	THIRD_QUARTILE: 3,
	FOURTH_QUARTILE: 4,
} as const

const query = `
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

type ContributionsResponse = Awaited<ReturnType<typeof fetchGitHubContributionsFromApi>>

let contributionsCache:
	| {
		data: ContributionsResponse
		expiresAt: number
	}
	| undefined

let contributionsPromise: Promise<ContributionsResponse> | undefined

async function loadGitHubContributions() {
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

async function fetchGitHubContributionsFromApi() {
	const token = await getGitHubToken()

	const response = await fetch(GITHUB_GRAPHQL_API, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			'user-agent': 'minifolio',
		},
		body: JSON.stringify({
			query,
			variables: {
				login: GITHUB_LOGIN,
			},
		}),
	})

	if (!response.ok) {
		throw new Error(`GitHub API request failed with ${response.status}`)
	}

	const json = v.parse(githubContributionsResponseSchema, await response.json())

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
