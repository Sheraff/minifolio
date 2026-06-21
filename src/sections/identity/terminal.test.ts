import { describe, expect, it } from 'vitest'
import { autocomplete, resolveGit, type TerminalAutocompleteState } from './terminal'

type EntryType = 'directory' | 'file'
type FileTree = Record<string, Record<string, EntryType>>

const fileTree: FileTree = {
	'/': {
		etc: 'directory',
		home: 'directory',
	},
	'/etc': {
		hostname: 'file',
		motd: 'file',
	},
	'/home/sheraff': {
		'.bashrc': 'file',
		'about.txt': 'file',
		documents: 'directory',
		'portable.txt': 'file',
		'portfolio.txt': 'file',
		projects: 'directory',
	},
	'/home/sheraff/documents': {
		'mask.txt': 'file',
	},
	'/home/sheraff/projects': {
		'minifolio.txt': 'file',
		'tanstack.txt': 'file',
		'trpc.txt': 'file',
	},
}

describe('autocomplete', () => {
	const state = createState()

	it('completes unique command prefixes', async () => {
		expect(await autocomplete('por', state)).toBe('portfolio ')
	})

	it('matches command prefixes case-insensitively', async () => {
		expect(await autocomplete('PORT', state)).toBe('portfolio ')
	})

	it('does not choose a first command for ambiguous prefixes', async () => {
		expect(await autocomplete('c', state)).toBe('')
	})

	it('completes command names for command-taking commands', async () => {
		expect(await autocomplete('which por', state)).toBe('which portfolio ')
	})

	it('completes git subcommands after a prefix', async () => {
		expect(await autocomplete('git re', state)).toBe('git remote ')
		expect(await autocomplete('git st', state)).toBe('git status ')
	})

	it('prints the configured git remote', () => {
		expect(resolveGit(['remote', '-v']).stdout).toBe('origin\thttps://github.com/Sheraff/minifolio.git (fetch)\norigin\thttps://github.com/Sheraff/minifolio.git (push)\n')
		expect(resolveGit(['remote', 'get-url', 'origin']).stdout).toBe('https://github.com/Sheraff/minifolio.git\n')
	})

	it('does not complete empty argument slots', async () => {
		expect(await autocomplete('cat ', state)).toBe('')
		expect(await autocomplete('git ', state)).toBe('')
	})

	it('adds file and directory suffixes for single path matches', async () => {
		expect(await autocomplete('cat ab', state)).toBe('cat about.txt ')
		expect(await autocomplete('cd doc', state)).toBe('cd documents/')
	})

	it('extends ambiguous path matches only to their shared prefix', async () => {
		expect(await autocomplete('cat po', state)).toBe('cat port')
	})

	it('completes nested and absolute path fragments', async () => {
		expect(await autocomplete('cat ~/projects/mi', state)).toBe('cat ~/projects/minifolio.txt ')
		expect(await autocomplete('cat /e', state)).toBe('cat /etc/')
	})

	it('respects directory-only commands', async () => {
		expect(await autocomplete('cd ab', state)).toBe('')
		expect(await autocomplete('pushd doc', state)).toBe('pushd documents/')
	})

	it('hides dotfiles unless the fragment asks for them', async () => {
		expect(await autocomplete('ls b', state)).toBe('')
		expect(await autocomplete('ls .b', state)).toBe('ls .bashrc ')
	})

	it('completes command names after pipes', async () => {
		expect(await autocomplete('cat about.txt | gr', state)).toBe('cat about.txt | grep ')
		expect(await autocomplete('cat about.txt|gr', state)).toBe('cat about.txt|grep ')
	})

	it('preserves whitespace after composition operators', async () => {
		expect(await autocomplete('cat about.txt |   gr', state)).toBe('cat about.txt |   grep ')
	})

	it('completes after boolean operators and semicolons', async () => {
		expect(await autocomplete('false || por', state)).toBe('false || portfolio ')
		expect(await autocomplete('true && cd doc', state)).toBe('true && cd documents/')
		expect(await autocomplete('history; git st', state)).toBe('history; git status ')
	})

	it('ignores quoted and escaped composition operators', async () => {
		expect(await autocomplete('echo "|" gr', state)).toBe('')
		expect(await autocomplete('echo \\| gr', state)).toBe('')
	})
})

function createState(cwd = '/home/sheraff'): TerminalAutocompleteState {
	return {
		cwd,
		bash: {
			fs: {
				async readdir(path: string) {
					const entries = fileTree[path]
					if (!entries) throw new Error(`Directory does not exist: ${path}`)
					return Object.keys(entries)
				},
				async stat(path: string) {
					return { isDirectory: getEntryType(path) === 'directory' }
				},
			},
		} as unknown as TerminalAutocompleteState['bash'],
	}
}

function getEntryType(path: string) {
	const slashIndex = path.lastIndexOf('/')
	const parent = slashIndex <= 0 ? '/' : path.slice(0, slashIndex)
	const name = path.slice(slashIndex + 1)
	const type = fileTree[parent]?.[name]
	if (!type) throw new Error(`File does not exist: ${path}`)
	return type
}
