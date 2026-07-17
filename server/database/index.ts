import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'

export type Database = ReturnType<typeof drizzle>

export function createDatabase(databasePath: string, migrationsFolder: string) {
	if (databasePath !== ':memory:') {
		mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 })
	}

	const sqlite = new DatabaseSync(databasePath)

	try {
		sqlite.exec('PRAGMA journal_mode = WAL')
		sqlite.exec('PRAGMA foreign_keys = ON')
		sqlite.exec('PRAGMA busy_timeout = 5000')
		const db = drizzle({ client: sqlite })
		const migrationResult = migrate(db, { migrationsFolder })

		if (migrationResult) {
			throw new Error(`Unable to initialize database migrations: ${migrationResult.exitCode}`)
		}

		return {
			db,
			close: () => sqlite.close(),
		}
	} catch (error) {
		sqlite.close()
		throw error
	}
}
