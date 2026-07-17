import { expect, test } from 'vitest'
import { buildContributionsResponse } from './contributions.ts'
import { buildRepositoriesResponse } from './repositories.ts'
import type { RepositoryWindowEntry } from './types.ts'

test('builds a clipped, sorted contribution calendar with stable levels', () => {
	expect(buildContributionsResponse([
		[
			{ date: '2026-01-02', count: 5 },
			{ date: '2025-12-31', count: 100 },
		],
		[
			{ date: '2026-01-03', count: 10 },
			{ date: '2026-01-02', count: 1 },
			{ date: '2026-01-01', count: 0 },
		],
	], '2026-01-01', '2026-01-03')).toEqual({
		total: { lastYear: 11 },
		contributions: [
			{ date: '2026-01-01', count: 0, level: 0 },
			{ date: '2026-01-02', count: 1, level: 1 },
			{ date: '2026-01-03', count: 10, level: 4 },
		],
	})
})

test('merges renamed repositories by stable GitHub id', () => {
	const oldRepository = repository({
		name: 'old-name',
		nameWithOwner: 'someone/old-name',
		contributionCount: 2,
		lastContributedAt: '2025-06-01T00:00:00Z',
		lastPullRequest: {
			title: 'Older pull request',
			url: 'https://github.com/someone/old-name/pull/1',
			occurredAt: '2025-05-01T00:00:00Z',
		},
	})
	const renamedRepository = repository({
		name: 'new-name',
		nameWithOwner: 'someone/new-name',
		contributionCount: 3,
		lastContributedAt: '2026-06-01T00:00:00Z',
	})

	expect(buildRepositoriesResponse([[oldRepository], [renamedRepository]])).toEqual({
		repositories: [{
			name: 'new-name',
			nameWithOwner: 'someone/new-name',
			url: 'https://github.com/someone/example',
			description: null,
			owner: {
				login: 'someone',
				avatarUrl: 'https://avatars.githubusercontent.com/u/1',
			},
			imageUrl: 'https://avatars.githubusercontent.com/u/1',
			imageSource: 'owner',
			contributionCount: 5,
			lastContributedAt: '2026-06-01T00:00:00Z',
			lastPullRequest: oldRepository.lastPullRequest,
		}],
	})
})

function repository(overrides: Partial<RepositoryWindowEntry>): RepositoryWindowEntry {
	return {
		id: 'repository-1',
		name: 'example',
		nameWithOwner: 'someone/example',
		url: 'https://github.com/someone/example',
		description: null,
		owner: {
			login: 'someone',
			avatarUrl: 'https://avatars.githubusercontent.com/u/1',
		},
		imageUrl: 'https://avatars.githubusercontent.com/u/1',
		imageSource: 'owner',
		contributionCount: 1,
		lastContributedAt: '2026-01-01T00:00:00Z',
		lastPullRequest: null,
		...overrides,
	}
}
