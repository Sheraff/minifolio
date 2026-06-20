import { execFile } from "node:child_process"
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let tokenPromise: Promise<string> | undefined
let token: string | undefined

export async function getGitHubToken() {
	if (token) return token
	if (!tokenPromise) {
		tokenPromise = resolveGitHubToken()
	}

	return tokenPromise
}

async function resolveGitHubToken() {
	const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
	if (envToken) {
		return envToken
	}

	try {
		const { stdout } = await execFileAsync('gh', ['auth', 'token'])
		const t = stdout.trim()

		if (!t) {
			throw new Error('GitHub CLI returned an empty token')
		}
		token = t
		return t
	} catch {
		tokenPromise = undefined
		throw new Error('Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN.')
	}
}