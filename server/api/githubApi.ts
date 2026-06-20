import { getGitHubToken } from './getGithubToken.ts'

export const ONE_DAY_MS = 24 * 60 * 60 * 1000
export const GITHUB_LOGIN = 'sheraff'
export const GITHUB_LOGIN_NORMALIZED = GITHUB_LOGIN.trim().toLowerCase()

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql'

export async function fetchGitHubGraphql(query: string, variables: Record<string, unknown>) {
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
			variables,
		}),
	})

	if (!response.ok) {
		throw new Error(`GitHub API request failed with ${response.status}`)
	}

	return response.json()
}
