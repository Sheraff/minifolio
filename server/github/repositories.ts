import * as v from 'valibot'
import type { FetchGitHubGraphql } from '../api/githubApi.ts'
import { parseGraphQLResponse } from './errors.ts'
import type {
	GitHubRepositoriesResponse,
	RepositoryWindowEntry,
} from './types.ts'
import { toGraphqlRange, type DateWindow } from './windows.ts'

const contributionYearsQuery = `
	query ContributionYears($login: String!) {
		user(login: $login) {
			contributionsCollection {
				contributionYears
			}
		}
	}
`

const contributedRepositoriesQuery = `
	fragment RepositoryFields on Repository {
		id
		name
		nameWithOwner
		url
		description
		openGraphImageUrl
		usesCustomOpenGraphImage
		owner { login avatarUrl }
	}

	query ContributedRepositories($login: String!, $from: DateTime!, $to: DateTime!) {
		user(login: $login) {
			contributionsCollection(from: $from, to: $to) {
				commitContributionsByRepository(maxRepositories: 100) {
					repository { ...RepositoryFields }
					contributions(first: 1, orderBy: { field: OCCURRED_AT, direction: DESC }) {
						totalCount
						nodes { occurredAt }
					}
				}
				issueContributionsByRepository(maxRepositories: 100) {
					repository { ...RepositoryFields }
					contributions(first: 1) {
						totalCount
						nodes { occurredAt }
					}
				}
				pullRequestContributionsByRepository(maxRepositories: 100) {
					repository { ...RepositoryFields }
					contributions(first: 1) {
						totalCount
						nodes { occurredAt pullRequest { title url } }
					}
				}
				pullRequestReviewContributionsByRepository(maxRepositories: 100) {
					repository { ...RepositoryFields }
					contributions(first: 1) {
						totalCount
						nodes { occurredAt pullRequest { title url } }
					}
				}
			}
		}
	}
`

const contributionYearsResponseSchema = v.object({
	data: v.optional(v.object({
		user: v.nullable(v.object({
			contributionsCollection: v.object({
				contributionYears: v.array(v.number()),
			}),
		})),
	})),
})

const repositorySchema = v.object({
	id: v.string(),
	name: v.string(),
	nameWithOwner: v.string(),
	url: v.string(),
	description: v.nullable(v.string()),
	openGraphImageUrl: v.nullable(v.string()),
	usesCustomOpenGraphImage: v.boolean(),
	owner: v.object({
		login: v.string(),
		avatarUrl: v.string(),
	}),
})

type SourceRepository = v.InferOutput<typeof repositorySchema>

const repositoryContributionSchema = v.object({
	repository: repositorySchema,
	contributions: v.object({
		totalCount: v.number(),
		nodes: v.array(v.object({ occurredAt: v.string() })),
	}),
})

const pullRequestContributionSchema = v.object({
	repository: repositorySchema,
	contributions: v.object({
		totalCount: v.number(),
		nodes: v.array(v.object({
			occurredAt: v.string(),
			pullRequest: v.object({
				title: v.string(),
				url: v.string(),
			}),
		})),
	}),
})

const contributedRepositoriesResponseSchema = v.object({
	data: v.optional(v.object({
		user: v.nullable(v.object({
			contributionsCollection: v.object({
				commitContributionsByRepository: v.array(repositoryContributionSchema),
				issueContributionsByRepository: v.array(repositoryContributionSchema),
				pullRequestContributionsByRepository: v.array(pullRequestContributionSchema),
				pullRequestReviewContributionsByRepository: v.array(pullRequestContributionSchema),
			}),
		})),
	})),
})

export async function fetchContributionYears(
	fetchGraphql: FetchGitHubGraphql,
	login: string,
	signal: AbortSignal,
) {
	const json = parseGraphQLResponse(
		contributionYearsResponseSchema,
		await fetchGraphql(contributionYearsQuery, { login }, signal),
	)

	const years = json.data?.user?.contributionsCollection.contributionYears
	if (!years) throw new Error(`GitHub user not found: ${login}`)
	return years
}

export async function fetchRepositoryWindow(
	fetchGraphql: FetchGitHubGraphql,
	login: string,
	window: DateWindow,
	signal: AbortSignal,
) {
	const json = parseGraphQLResponse(
		contributedRepositoriesResponseSchema,
		await fetchGraphql(contributedRepositoriesQuery, {
			login,
			...toGraphqlRange(window),
		}, signal),
	)
	const collection = json.data?.user?.contributionsCollection
	if (!collection) throw new Error(`GitHub user not found: ${login}`)

	const repositories = new Map<string, RepositoryWindowEntry>()
	const normalizedLogin = login.trim().toLowerCase()

	for (const group of [
		...collection.commitContributionsByRepository,
		...collection.issueContributionsByRepository,
	]) {
		registerSourceContribution(
			repositories,
			normalizedLogin,
			group.repository,
			group.contributions.totalCount,
			group.contributions.nodes[0]?.occurredAt ?? null,
		)
	}
	for (const group of [
		...collection.pullRequestContributionsByRepository,
		...collection.pullRequestReviewContributionsByRepository,
	]) {
		const contribution = group.contributions.nodes[0]
		registerSourceContribution(
			repositories,
			normalizedLogin,
			group.repository,
			group.contributions.totalCount,
			contribution?.occurredAt ?? null,
			contribution ? {
				title: contribution.pullRequest.title,
				url: contribution.pullRequest.url,
				occurredAt: contribution.occurredAt,
			} : null,
		)
	}

	return Array.from(repositories.values())
}

export function buildRepositoriesResponse(windows: RepositoryWindowEntry[][]): GitHubRepositoriesResponse {
	const repositories = new Map<string, RepositoryWindowEntry>()

	for (const window of windows) {
		for (const repository of window) {
			const existing = repositories.get(repository.id)
			if (!existing) {
				repositories.set(repository.id, structuredClone(repository))
				continue
			}

			mergeRepository(existing, repository)
		}
	}

	return {
		repositories: Array.from(repositories.values(), ({ id: _, ...repository }) => repository)
			.sort((left, right) => right.lastContributedAt.localeCompare(left.lastContributedAt)),
	}
}

function registerSourceContribution(
	repositories: Map<string, RepositoryWindowEntry>,
	login: string,
	repository: SourceRepository,
	count: number,
	lastContributedAt: string | null,
	lastPullRequest: RepositoryWindowEntry['lastPullRequest'] = null,
) {
	if (repository.owner.login.trim().toLowerCase() === login || count <= 0) return

	const repositoryImage = repository.usesCustomOpenGraphImage
		? repository.openGraphImageUrl
		: null
	const incoming: RepositoryWindowEntry = {
		id: repository.id,
		name: repository.name,
		nameWithOwner: repository.nameWithOwner,
		url: repository.url,
		description: repository.description,
		owner: repository.owner,
		imageUrl: repositoryImage ?? repository.owner.avatarUrl,
		imageSource: repositoryImage ? 'repository' : 'owner',
		contributionCount: count,
		lastContributedAt: lastContributedAt ?? '',
		lastPullRequest,
	}
	const existing = repositories.get(repository.id)
	if (existing) mergeRepository(existing, incoming)
	else repositories.set(repository.id, incoming)
}

function mergeRepository(existing: RepositoryWindowEntry, incoming: RepositoryWindowEntry) {
	const contributionCount = existing.contributionCount + incoming.contributionCount
	const lastPullRequest = !existing.lastPullRequest
		|| (incoming.lastPullRequest
			&& incoming.lastPullRequest.occurredAt > existing.lastPullRequest.occurredAt)
		? incoming.lastPullRequest
		: existing.lastPullRequest

	if (incoming.lastContributedAt > existing.lastContributedAt) {
		Object.assign(existing, incoming)
	}
	existing.contributionCount = contributionCount
	existing.lastPullRequest = lastPullRequest
}
