import * as v from 'valibot'
import {
	fetchGitHubGraphql,
	GITHUB_LOGIN,
	GITHUB_LOGIN_NORMALIZED,
	ONE_DAY_MS,
} from './githubApi.ts'

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
	query ContributedRepositories($login: String!, $from: DateTime!, $to: DateTime!) {
		user(login: $login) {
			contributionsCollection(from: $from, to: $to) {
				commitContributionsByRepository(maxRepositories: 100) {
					repository {
						name
						nameWithOwner
						url
						description
						openGraphImageUrl
						usesCustomOpenGraphImage
						owner {
							login
							avatarUrl
						}
					}
					contributions(first: 1, orderBy: { field: OCCURRED_AT, direction: DESC }) {
						totalCount
						nodes {
							occurredAt
						}
					}
				}
				issueContributionsByRepository(maxRepositories: 100) {
					repository {
						name
						nameWithOwner
						url
						description
						openGraphImageUrl
						usesCustomOpenGraphImage
						owner {
							login
							avatarUrl
						}
					}
					contributions(first: 1) {
						totalCount
						nodes {
							occurredAt
						}
					}
				}
				pullRequestContributionsByRepository(maxRepositories: 100) {
					repository {
						name
						nameWithOwner
						url
						description
						openGraphImageUrl
						usesCustomOpenGraphImage
						owner {
							login
							avatarUrl
						}
					}
					contributions(first: 1) {
						totalCount
						nodes {
							occurredAt
							pullRequest {
								title
								url
							}
						}
					}
				}
				pullRequestReviewContributionsByRepository(maxRepositories: 100) {
					repository {
						name
						nameWithOwner
						url
						description
						openGraphImageUrl
						usesCustomOpenGraphImage
						owner {
							login
							avatarUrl
						}
					}
					contributions(first: 1) {
						totalCount
						nodes {
							occurredAt
							pullRequest {
								title
								url
							}
						}
					}
				}
			}
		}
	}
`

type ContributedRepository = {
	name: string
	nameWithOwner: string
	url: string
	description: string | null
	owner: {
		login: string
		avatarUrl: string
	}
	imageUrl: string
	imageSource: 'owner' | 'repository'
	contributionCount: number
	lastContributedAt: string
	lastPullRequest:
		| {
			title: string
			url: string
			occurredAt: string
		}
		| null
}

type ContributedRepositoriesResponse = {
	repositories: ContributedRepository[]
}

type ContributedRepositoryMapValue = ContributedRepository

type PullRequestDetails = NonNullable<ContributedRepository['lastPullRequest']>

type SourceRepository = {
	name: string
	nameWithOwner: string
	url: string
	description: string | null
	openGraphImageUrl: string | null
	usesCustomOpenGraphImage: boolean
	owner: {
		login: string
		avatarUrl: string
	}
}

const githubContributionYearsResponseSchema = v.object({
	data: v.optional(v.object({
		user: v.nullable(v.object({
			contributionsCollection: v.object({
				contributionYears: v.array(v.number()),
			}),
		})),
	})),
	errors: v.optional(v.array(v.object({
		message: v.string(),
	}))),
})

const repositoryOwnerSchema = v.object({
	login: v.string(),
	avatarUrl: v.string(),
})

const contributedRepositorySchema = v.object({
	name: v.string(),
	nameWithOwner: v.string(),
	url: v.string(),
	description: v.nullable(v.string()),
	openGraphImageUrl: v.nullable(v.string()),
	usesCustomOpenGraphImage: v.boolean(),
	owner: repositoryOwnerSchema,
})

const occurredAtSchema = v.object({
	occurredAt: v.string(),
})

const pullRequestContributionNodeSchema = v.object({
	occurredAt: v.string(),
	pullRequest: v.object({
		title: v.string(),
		url: v.string(),
	}),
})

const repositoryContributionGroupSchema = v.object({
	repository: contributedRepositorySchema,
	contributions: v.object({
		totalCount: v.number(),
		nodes: v.array(occurredAtSchema),
	}),
})

const pullRequestContributionGroupSchema = v.object({
	repository: contributedRepositorySchema,
	contributions: v.object({
		totalCount: v.number(),
		nodes: v.array(pullRequestContributionNodeSchema),
	}),
})

const githubContributedRepositoriesResponseSchema = v.object({
	data: v.optional(v.object({
		user: v.nullable(v.object({
			contributionsCollection: v.object({
				commitContributionsByRepository: v.array(repositoryContributionGroupSchema),
				issueContributionsByRepository: v.array(repositoryContributionGroupSchema),
				pullRequestContributionsByRepository: v.array(pullRequestContributionGroupSchema),
				pullRequestReviewContributionsByRepository: v.array(pullRequestContributionGroupSchema),
			}),
		})),
	})),
	errors: v.optional(v.array(v.object({
		message: v.string(),
	}))),
})

let contributedRepositoriesCache:
	| {
		data: ContributedRepositoriesResponse
		expiresAt: number
	}
	| undefined

let contributedRepositoriesPromise: Promise<ContributedRepositoriesResponse> | undefined

async function loadContributedRepositories(): Promise<ContributedRepositoriesResponse> {
	if (contributedRepositoriesCache && contributedRepositoriesCache.expiresAt > Date.now()) {
		return contributedRepositoriesCache.data
	}

	if (contributedRepositoriesPromise) {
		return contributedRepositoriesPromise
	}

	contributedRepositoriesPromise = fetchContributedRepositoriesFromApi()

	try {
		const data = await contributedRepositoriesPromise
		contributedRepositoriesCache = {
			data,
			expiresAt: Date.now() + ONE_DAY_MS,
		}
		return data
	} finally {
		contributedRepositoriesPromise = undefined
	}
}

async function fetchContributionYearsFromApi(): Promise<number[]> {
	const json = v.parse(
		githubContributionYearsResponseSchema,
		await fetchGitHubGraphql(contributionYearsQuery, {
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

	const contributionYears = data.user?.contributionsCollection.contributionYears
	if (!contributionYears) {
		throw new Error(`GitHub user not found: ${GITHUB_LOGIN}`)
	}

	return contributionYears
}

async function fetchContributedRepositoriesSliceFromApi(year: number) {
	const json = v.parse(
		githubContributedRepositoriesResponseSchema,
		await fetchGitHubGraphql(contributedRepositoriesQuery, {
			login: GITHUB_LOGIN,
			from: `${year}-01-01T00:00:00Z`,
			to: `${year}-12-31T23:59:59Z`,
		}),
	)

	if (json.errors?.length) {
		throw new Error(json.errors[0].message)
	}

	const data = json.data
	if (!data) {
		throw new Error('GitHub API returned no data')
	}

	const contributionsCollection = data.user?.contributionsCollection
	if (!contributionsCollection) {
		throw new Error(`GitHub user not found: ${GITHUB_LOGIN}`)
	}

	return contributionsCollection
}

async function fetchContributedRepositoriesFromApi(): Promise<ContributedRepositoriesResponse> {
	const years = await fetchContributionYearsFromApi()
	const contributionSlices = await Promise.all(
		years.map((year) => fetchContributedRepositoriesSliceFromApi(year)),
	)
	const repositories = new Map<string, ContributedRepositoryMapValue>()

	for (const contributionSlice of contributionSlices) {
		for (const group of contributionSlice.commitContributionsByRepository) {
			registerRepositoryContribution(
				repositories,
				group.repository,
				group.contributions.totalCount,
				group.contributions.nodes[0]?.occurredAt ?? null,
			)
		}

		for (const group of contributionSlice.issueContributionsByRepository) {
			registerRepositoryContribution(
				repositories,
				group.repository,
				group.contributions.totalCount,
				group.contributions.nodes[0]?.occurredAt ?? null,
			)
		}

		for (const group of contributionSlice.pullRequestContributionsByRepository) {
			const lastContribution = group.contributions.nodes[0]
			registerRepositoryContribution(
				repositories,
				group.repository,
				group.contributions.totalCount,
				lastContribution?.occurredAt ?? null,
				lastContribution
					? {
						title: lastContribution.pullRequest.title,
						url: lastContribution.pullRequest.url,
						occurredAt: lastContribution.occurredAt,
					}
					: null,
			)
		}

		for (const group of contributionSlice.pullRequestReviewContributionsByRepository) {
			const lastContribution = group.contributions.nodes[0]
			registerRepositoryContribution(
				repositories,
				group.repository,
				group.contributions.totalCount,
				lastContribution?.occurredAt ?? null,
				lastContribution
					? {
						title: lastContribution.pullRequest.title,
						url: lastContribution.pullRequest.url,
						occurredAt: lastContribution.occurredAt,
					}
					: null,
			)
		}
	}

	return {
		repositories: Array.from(repositories.values()).sort((left, right) =>
			right.lastContributedAt.localeCompare(left.lastContributedAt),
		),
	}
}

function registerRepositoryContribution(
	repositories: Map<string, ContributedRepositoryMapValue>,
	repository: SourceRepository,
	contributionCount: number,
	lastContributedAt: string | null,
	lastPullRequest: PullRequestDetails | null = null,
) {
	if (repository.owner.login.trim().toLowerCase() === GITHUB_LOGIN_NORMALIZED) {
		return
	}

	if (contributionCount <= 0) {
		return
	}

	const key = repository.nameWithOwner.toLowerCase()
	const imageUrl = repository.usesCustomOpenGraphImage && repository.openGraphImageUrl
		? repository.openGraphImageUrl
		: repository.owner.avatarUrl
	const imageSource = repository.usesCustomOpenGraphImage && repository.openGraphImageUrl
		? 'repository'
		: 'owner'
	const existing = repositories.get(key)

	if (!existing) {
		repositories.set(key, {
			name: repository.name,
			nameWithOwner: repository.nameWithOwner,
			url: repository.url,
			description: repository.description,
			owner: {
				login: repository.owner.login,
				avatarUrl: repository.owner.avatarUrl,
			},
			imageUrl,
			imageSource,
			contributionCount,
			lastContributedAt: lastContributedAt ?? '',
			lastPullRequest,
		})
		return
	}

	existing.contributionCount += contributionCount

	if (lastContributedAt && lastContributedAt > existing.lastContributedAt) {
		existing.lastContributedAt = lastContributedAt
	}

	if (
		lastPullRequest &&
		(!existing.lastPullRequest || lastPullRequest.occurredAt > existing.lastPullRequest.occurredAt)
	) {
		existing.lastPullRequest = lastPullRequest
	}
}

export async function fetchContributedRepositories() {
	return loadContributedRepositories()
}
