import * as v from 'valibot'

export const githubResources = ['contributions', 'repositories'] as const
export type GitHubResource = typeof githubResources[number]

export const contributionDaySchema = v.object({
	date: v.string(),
	count: v.number(),
})

export const contributionDaysSchema = v.array(contributionDaySchema)

export const contributionsResponseSchema = v.object({
	total: v.object({ lastYear: v.number() }),
	contributions: v.array(v.object({
		date: v.string(),
		count: v.number(),
		level: v.number(),
	})),
})

const repositoryFields = {
	name: v.string(),
	nameWithOwner: v.string(),
	url: v.string(),
	description: v.nullable(v.string()),
	owner: v.object({
		login: v.string(),
		avatarUrl: v.string(),
	}),
	imageUrl: v.string(),
	imageSource: v.picklist(['owner', 'repository']),
	contributionCount: v.number(),
	lastContributedAt: v.string(),
	lastPullRequest: v.nullable(v.object({
		title: v.string(),
		url: v.string(),
		occurredAt: v.string(),
	})),
}

export const repositoryWindowEntrySchema = v.object({
	id: v.string(),
	...repositoryFields,
})

export const repositoryWindowSchema = v.array(repositoryWindowEntrySchema)
export const contributedRepositorySchema = v.object(repositoryFields)

export const repositoriesResponseSchema = v.object({
	repositories: v.array(contributedRepositorySchema),
})

export type GitHubContributionDay = v.InferOutput<typeof contributionDaySchema>
export type GitHubContributionsResponse = v.InferOutput<typeof contributionsResponseSchema>
export type RepositoryWindowEntry = v.InferOutput<typeof repositoryWindowEntrySchema>
export type ContributedRepository = v.InferOutput<typeof contributedRepositorySchema>
export type GitHubRepositoriesResponse = v.InferOutput<typeof repositoriesResponseSchema>

export type GitHubService = {
	getContributions: () => Promise<GitHubContributionsResponse>
	getRepositories: () => Promise<GitHubRepositoriesResponse>
}
