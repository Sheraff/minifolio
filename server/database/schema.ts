import { sql } from 'drizzle-orm'
import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import {
	githubResources,
	type GitHubContributionsResponse,
	type GitHubRepositoriesResponse,
} from '../github/types.ts'

const windowStates = ['ready', 'split'] as const

export const githubWindows = sqliteTable('github_windows', {
	resource: text('resource', { enum: githubResources }).notNull(),
	login: text('login').notNull(),
	fromDate: text('from_date').notNull(),
	toDate: text('to_date').notNull(),
	state: text('state', { enum: windowStates }).notNull(),
	payload: text('payload', { mode: 'json' }).$type<unknown>(),
	expiresAt: integer('expires_at').notNull(),
}, (table) => [
	primaryKey({ columns: [table.resource, table.login, table.fromDate, table.toDate] }),
	check('github_windows_resource_check', sql`${table.resource} in ('contributions', 'repositories')`),
	check('github_windows_state_check', sql`${table.state} in ('ready', 'split')`),
])

export const githubSnapshots = sqliteTable('github_snapshots', {
	resource: text('resource', { enum: githubResources }).notNull(),
	login: text('login').notNull(),
	payload: text('payload', { mode: 'json' })
		.$type<GitHubContributionsResponse | GitHubRepositoriesResponse>()
		.notNull(),
	updatedAt: integer('updated_at').notNull(),
}, (table) => [
	primaryKey({ columns: [table.resource, table.login] }),
	check('github_snapshots_resource_check', sql`${table.resource} in ('contributions', 'repositories')`),
])
