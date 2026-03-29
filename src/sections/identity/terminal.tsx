import { createEffect, onMount, type Accessor, type Setter } from "solid-js"

const RAW_FILES = {
	...import.meta.glob('/fs/**', { eager: true, query: '?raw', import: 'default' }),
	...import.meta.glob('/fs/**/.*', { eager: true, query: '?raw', import: 'default' }),
} as Record<string, string>

export type HistoryEntry = { command: string, result: string }

export function InteractiveTerminal(props: {
	history: Accessor<HistoryEntry[]>
	setHistory: Setter<HistoryEntry[]>
	input: Accessor<string>
	setInput: Setter<string>
}) {
	const state: TerminalState = {}
	let historyCursor = 0

	createEffect(() => {
		historyCursor = props.history().length
	})

	let textarea: HTMLTextAreaElement | undefined
	onMount(() => textarea?.focus())


	// handle accumulated lines that might have happened while lazy loading
	const lines = props.input().split('\n')
	if (lines.length > 1) {
		for (let i = 0; i < lines.length - 1; i++) {
			handleSubmit(lines[i])
		}
		props.setInput(lines.at(-1)!)
	}

	function handleSubmit(value: string) {
		const entry = resolveCommand(value, state)
		if (entry.clear) props.setHistory([])
		else props.setHistory(p => [...p, entry])
	}

	return (
		<textarea
			ref={textarea}
			autofocus
			name="tty"
			value={props.input()}
			on:input={e => props.setInput(e.target.value)}
			on:keydown={e => {
				if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.metaKey) {
					e.preventDefault()
					const value = e.currentTarget.value
					if (value) {
						handleSubmit(value)
						e.currentTarget.value = ''
					}
				} else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.metaKey) {
					e.preventDefault()
					const suggestion = autocomplete(e.currentTarget.value, state)
					if (suggestion) e.currentTarget.value = suggestion
				} else if (e.key === 'Escape' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.metaKey) {
					e.preventDefault()
					e.currentTarget.blur()
					e.currentTarget.value = ''
				} else if (e.key === 'k' && !e.shiftKey && !e.ctrlKey && !e.metaKey && e.metaKey) {
					e.preventDefault()
					props.setHistory([])
				} else if (e.key === 'c' && !e.shiftKey && e.ctrlKey && !e.metaKey && !e.metaKey) {
					e.preventDefault()
					props.setHistory([])
					e.currentTarget.blur()
					e.currentTarget.value = ''
				} else if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.metaKey) {
					if (historyCursor > 0) {
						historyCursor--
						e.currentTarget.value = props.history()[historyCursor].command
						e.preventDefault()
					}
				} else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.metaKey) {
					if (historyCursor < props.history().length) {
						historyCursor++
						if (historyCursor === props.history().length) {
							e.currentTarget.value = ''
						} else {
							e.currentTarget.value = props.history()[historyCursor].command
						}
						e.preventDefault()
					}
				}
			}} />
	)
}


type TerminalState = {
	cwd?: string
	previousCwd?: string
	history?: string[]
	fs?: Record<string, FsEntry | null>
}

type DirectoryEntry = {
	type: 'dir'
	entries: string[]
}

type FileEntry = {
	type: 'file'
	content: string
}

type FsEntry = DirectoryEntry | FileEntry

type Redirection = {
	operator: '>' | '>>'
	target: string
}

const HOME = '/home/sheraff'

const ALIASES = {
	ll: 'ls -la',
	portfolio: 'cat /home/sheraff/about.txt',
	mask: 'cat /home/sheraff/documents/mask.txt',
} as const

const COMMANDS = [
	'help',
	'clear',
	'whoami',
	'hostname',
	'pwd',
	'cd',
	'ls',
	'tree',
	'cat',
	'echo',
	'date',
	'git',
	'uname',
	'id',
	'which',
	'history',
	'man',
	'sudo',
	'rm',
	'mkdir',
	'touch',
	'curl',
	'wget',
	'ssh',
	'cp',
	'mv',
	'exit',
] as const

const GIT_SUBCOMMANDS = ['branch', 'config', 'log', 'status'] as const

const PATH_COMMANDS = new Set(['cd', 'ls', 'tree', 'cat', 'cp', 'mv', 'touch', 'mkdir'])

const CLEAR_SIGNAL = '__clear__'

const FILE_SYSTEM = buildFileSystem(RAW_FILES)

function buildFileSystem(rawFiles: Record<string, string>): Record<string, FsEntry> {
	const directories = new Map<string, Set<string>>([['/', new Set()]])
	const files: Record<string, FileEntry> = {}

	for (const [key, content] of Object.entries(rawFiles)) {
		const path = key.slice(3)
		const segments = path.split('/').filter(Boolean)
		const name = segments.at(-1)
		if (!name) continue

		let current = '/'
		for (const segment of segments.slice(0, -1)) {
			directories.get(current)?.add(segment)
			current = joinPath(current, segment)
			if (!directories.has(current)) directories.set(current, new Set())
		}

		directories.get(current)?.add(name)
		files[path] = { type: 'file', content }
	}

	return {
		...Object.fromEntries([...directories.entries()].map(([path, entries]) => [path, {
			type: 'dir' as const,
			entries: [...entries],
		}])),
		...files,
	}
}

function autocomplete(command: string, state: TerminalState): string {
	const rawTokens = command.match(/\S+/g) ?? []
	if (rawTokens.length === 0) return ''

	const endsWithSpace = /\s$/.test(command)
	const expandedTokens = expandAlias(rawTokens)
	const effectiveCommand = expandedTokens[0] ?? rawTokens[0] ?? ''

	if (rawTokens.length === 1 && !endsWithSpace) {
		const match = findFirstMatch([...COMMANDS, ...Object.keys(ALIASES)], rawTokens[0])
		if (!match || match === rawTokens[0]) return ''
		return `${match} `
	}

	if ((effectiveCommand === 'which' || effectiveCommand === 'man') && rawTokens.length <= 2) {
		const target = endsWithSpace ? '' : rawTokens[rawTokens.length - 1]
		const match = findFirstMatch([...COMMANDS, ...Object.keys(ALIASES)], target)
		if (!match || match === target) return ''
		return replaceLastToken(command, `${match} `, endsWithSpace)
	}

	if (effectiveCommand === 'git') {
		const target = endsWithSpace ? '' : rawTokens[rawTokens.length - 1]
		const shouldCompleteSubcommand = rawTokens.length === 1 || (rawTokens.length === 2 && !rawTokens[1].startsWith('-')) || (rawTokens.length === 1 && endsWithSpace)
		if (shouldCompleteSubcommand) {
			const match = findFirstMatch(GIT_SUBCOMMANDS, target)
			if (!match || match === target) return ''
			return replaceLastToken(command, `${match} `, endsWithSpace)
		}
	}

	if (effectiveCommand === 'echo' && rawTokens.length >= 2) {
		const target = endsWithSpace ? '' : rawTokens[rawTokens.length - 1]
		const previous = endsWithSpace ? rawTokens[rawTokens.length - 1] : rawTokens[rawTokens.length - 2]
		if ((previous === '>' || previous === '>>') && !target.startsWith('-')) {
			const completion = completePath(target, state.cwd ?? HOME, state, { directoriesOnly: false, allowHidden: target.split('/').at(-1)?.startsWith('.') === true })
			if (!completion || completion === target) return ''
			return replaceLastToken(command, completion, endsWithSpace)
		}
	}

	if (!PATH_COMMANDS.has(effectiveCommand)) return ''

	const target = endsWithSpace ? '' : rawTokens[rawTokens.length - 1]
	if (target.startsWith('-')) return ''

	const directoriesOnly = effectiveCommand === 'cd' || effectiveCommand === 'mkdir'
	const allowHidden = target.split('/').at(-1)?.startsWith('.') === true || expandedTokens.slice(1).some(arg => arg.startsWith('-') && arg.includes('a'))
	const completion = completePath(target, state.cwd ?? HOME, state, { directoriesOnly, allowHidden })
	if (!completion || completion === target) return ''
	return replaceLastToken(command, completion, endsWithSpace)
}

function resolveCommand(command: string, state: TerminalState) {
	const input = command.trim()
	if (!input) {
		return { command: '', result: '', clear: false }
	}

	if (!state.cwd) state.cwd = HOME
	if (!state.history) state.history = []
	state.history.push(input)

	const parsed = parseCommand(input)
	if ('error' in parsed) {
		return { command: input, result: parsed.error, clear: false }
	}

	const [name, ...args] = expandAlias(parsed.args)
	const redirection = extractRedirection(args)
	if ('error' in redirection) {
		return { command: input, result: redirection.error, clear: false }
	}

	const result = resolveBuiltin(name, redirection.args, state, redirection.redirection)
	if (result === CLEAR_SIGNAL) {
		return { command: input, result: '', clear: true }
	}
	return { command: input, result, clear: false }
}

function resolveBuiltin(name: string, args: string[], state: TerminalState, redirection?: Redirection) {
	if (redirection && name !== 'echo') {
		return 'shell redirection is only supported with echo in this tiny terminal'
	}

	switch (name) {
		case 'help':
			return 'Supported: help, clear, whoami, hostname, pwd, cd, ls, tree, cat, echo, date, git, uname, id, which, history, man\nAliases: ll, portfolio\n`echo ... > file`, `echo ... >> file`, `touch`, `mkdir`, `cp`, and `mv` can modify files\nAlso recognized in a mostly joke capacity: sudo, rm, curl, exit'
		case 'clear':
			return CLEAR_SIGNAL
		case 'whoami':
			return 'sheraff'
		case 'hostname':
			if (args.length === 0) return 'minifolio'
			if (args.length === 1 && args[0] === '-f') return 'florianpellet.com'
			return `hostname: unsupported option ${args[0]}`
		case 'pwd':
			return state.cwd ?? HOME
		case 'cd':
			return resolveCd(args, state)
		case 'ls':
			return resolveLs(args, state)
		case 'tree':
			return resolveTree(args, state)
		case 'cat':
			return resolveCat(args, state)
		case 'echo':
			return resolveEcho(args, redirection, state)
		case 'date':
			return resolveDate(args)
		case 'git':
			return resolveGit(args)
		case 'uname':
			return args.includes('-a')
				? 'Portfolio minifolio 1.0.0 solidjs x86_64 delightful'
				: 'Portfolio'
		case 'id':
			return 'uid=1000(sheraff) gid=1000(sheraff) groups=1000(sheraff),2024(frontend)'
		case 'which':
			return resolveWhich(args)
		case 'history':
			return (state.history ?? []).map((entry, index) => `${index + 1}  ${entry}`).join('\n')
		case 'man':
			return args[0] ? `No manual entry for ${args[0]}` : 'What manual page do you want?'
		case 'sudo':
			return 'Nice try.'
		case 'rm':
			return 'rm: this terminal is read-only and emotionally attached to its files'
		case 'mkdir':
			return resolveMkdir(args, state)
		case 'touch':
			return resolveTouch(args, state)
		case 'cp':
			return resolveCopy(args, state)
		case 'mv':
			return resolveMove(args, state)
		case 'curl':
		case 'wget':
		case 'ssh':
			return `${name}: network access is disabled in this tiny universe`
		case 'exit':
			return 'This terminal lives here now.'
		default:
			return `${name}: command not found`
	}
}

function extractRedirection(args: string[]): { args: string[], redirection?: Redirection } | { error: string } {
	const redirectIndex = args.findIndex(arg => arg === '>' || arg === '>>')
	if (redirectIndex === -1) return { args }
	if (args.slice(redirectIndex + 1).length !== 1) return { error: 'unsupported redirection syntax' }

	return {
		args: args.slice(0, redirectIndex),
		redirection: {
			operator: args[redirectIndex] as Redirection['operator'],
			target: args[redirectIndex + 1],
		},
	}
}

function expandAlias(args: string[]) {
	if (args.length === 0) return args
	const alias = ALIASES[args[0] as keyof typeof ALIASES]
	if (!alias) return args
	const parsed = parseCommand(alias)
	if ('error' in parsed) return args
	return [...parsed.args, ...args.slice(1)]
}

function findFirstMatch(candidates: readonly string[], fragment: string) {
	const sorted = [...candidates].sort((left, right) => left.localeCompare(right))
	return sorted.find(candidate => candidate.startsWith(fragment))
}

function replaceLastToken(command: string, replacement: string, endsWithSpace: boolean) {
	if (endsWithSpace) {
		return `${command}${replacement}`
	}

	const lastWhitespace = command.search(/\s+[^\s]*$/)
	if (lastWhitespace === -1) return replacement
	const prefix = command.slice(0, lastWhitespace).trimEnd()
	return `${prefix} ${replacement}`
}

function completePath(fragment: string, cwd: string, state: TerminalState, options: { directoriesOnly: boolean, allowHidden: boolean }) {
	const slashIndex = fragment.lastIndexOf('/')
	const parentInput = slashIndex === -1 ? '' : fragment.slice(0, slashIndex)
	const partialName = slashIndex === -1 ? fragment : fragment.slice(slashIndex + 1)
	const directoryPath = resolvePath(cwd, parentInput || '.')
	const directory = getEntry(directoryPath, state)
	if (!directory || directory.type !== 'dir') return ''

	const match = [...directory.entries]
		.filter(name => options.allowHidden || !name.startsWith('.'))
		.filter(name => {
			if (!options.directoriesOnly) return true
			return getEntry(joinPath(directoryPath, name), state)?.type === 'dir'
		})
		.sort((left, right) => left.localeCompare(right))
		.find(name => name.startsWith(partialName))

	if (!match) return ''

	const matchedPath = joinPath(directoryPath, match)
	const suffix = getEntry(matchedPath, state)?.type === 'dir' ? '/' : ' '
	const base = parentInput ? `${parentInput}/` : ''
	return `${base}${match}${suffix}`
}

function resolveCd(args: string[], state: TerminalState) {
	if (args.length > 1) return 'cd: too many arguments'

	if (args[0] === '-') {
		if (!state.previousCwd) return 'cd: OLDPWD not set'
		const next = state.previousCwd
		state.previousCwd = state.cwd
		state.cwd = next
		return next
	}

	const target = resolvePath(state.cwd ?? HOME, args[0])
	const entry = getEntry(target, state)
	if (!entry) return `cd: ${args[0] ?? '~'}: No such file or directory`
	if (entry.type !== 'dir') return `cd: ${args[0]}: Not a directory`

	state.previousCwd = state.cwd
	state.cwd = target
	return ''
}

function resolveLs(args: string[], state: TerminalState) {
	let showAll = false
	let long = false
	const targets: string[] = []

	for (const arg of args) {
		if (arg === '--') continue
		if (arg.startsWith('-') && arg.length > 1) {
			for (const option of arg.slice(1)) {
				if (option === 'a') showAll = true
				else if (option === 'l') long = true
				else return `ls: unsupported option -- ${option}`
			}
			continue
		}
		targets.push(arg)
	}

	const paths = targets.length > 0 ? targets.map(target => resolvePath(state.cwd ?? HOME, target)) : [state.cwd ?? HOME]
	return paths
		.map((path, index) => formatLs(path, targets[index], state, { showAll, long, showHeader: paths.length > 1 }))
		.join('\n\n')
}

function formatLs(path: string, rawTarget: string | undefined, state: TerminalState, options: { showAll: boolean, long: boolean, showHeader: boolean }) {
	const entry = getEntry(path, state)
	if (!entry) return `ls: cannot access '${rawTarget ?? path}': No such file or directory`

	const lines: string[] = []
	if (options.showHeader) {
		lines.push(`${rawTarget ?? path}:`)
	}

	if (entry.type === 'file') {
		lines.push(formatLsEntry(basename(path), entry, options.long))
		return lines.join('\n')
	}

	const names = [...entry.entries].sort((left, right) => left.localeCompare(right))
	if (options.showAll) names.unshift('.', '..')

	if (options.long) {
		lines.push(...names.map(name => {
			if (name === '.' || name === '..') {
				return `drwxr-xr-x 1 sheraff sheraff 96 Mar 29 2026 ${name}/`
			}
			const child = getEntry(joinPath(path, name), state)
			if (!child) return `?--------- 1 sheraff sheraff   0 Mar 29 2026 ${name}`
			return formatLsEntry(name, child, true)
		}))
	}
	else {
		lines.push(names.map(name => {
			if (name === '.' || name === '..') return `${name}/`
			const child = getEntry(joinPath(path, name), state)
			return child ? formatLsEntry(name, child, false) : name
		}).join('  '))
	}

	return lines.join('\n')
}

function resolveTree(args: string[], state: TerminalState) {
	if (args.length > 1) return 'tree: too many arguments'
	const path = resolvePath(state.cwd ?? HOME, args[0])
	const entry = getEntry(path, state)
	if (!entry) return `tree: ${args[0] ?? path}: No such file or directory`

	const rootLabel = path === '/' ? '/' : basename(path)
	if (entry.type === 'file') return rootLabel

	return [rootLabel, ...walkTree(path, '', state)].join('\n')
}

function walkTree(path: string, prefix: string, state: TerminalState): string[] {
	const entry = getEntry(path, state)
	if (!entry || entry.type !== 'dir') return []

	const visibleNames = [...entry.entries].sort((left, right) => left.localeCompare(right)).filter(name => !name.startsWith('.'))
	return visibleNames.flatMap((name, index) => {
		const childPath = joinPath(path, name)
		const child = getEntry(childPath, state)
		if (!child) return []
		const last = index === visibleNames.length - 1
		const branch = `${prefix}${last ? '`-- ' : '|-- '}${name}${child.type === 'dir' ? '/' : ''}`
		if (child.type !== 'dir') return [branch]
		return [branch, ...walkTree(childPath, `${prefix}${last ? '    ' : '|   '}`, state)]
	})
}

function resolveCat(args: string[], state: TerminalState) {
	if (args.length === 0) return 'cat: missing operand'

	return args.map(rawPath => {
		const path = resolvePath(state.cwd ?? HOME, rawPath)
		const entry = getEntry(path, state)
		if (!entry) return `cat: ${rawPath}: No such file or directory`
		if (entry.type === 'dir') return `cat: ${rawPath}: Is a directory`
		return entry.content
	}).join('\n')
}

function resolveEcho(args: string[], redirection: Redirection | undefined, state: TerminalState) {
	const output = args.map(arg => arg === '$PWD' ? (state.cwd ?? HOME) : arg).join(' ')
	if (!redirection) return output
	return writeToFile(resolvePath(state.cwd ?? HOME, redirection.target), `${output}\n`, redirection.operator === '>>', state)
}

function resolveTouch(args: string[], state: TerminalState) {
	if (args.length === 0) return 'touch: missing file operand'

	for (const rawPath of args) {
		const path = resolvePath(state.cwd ?? HOME, rawPath)
		const parentPath = dirname(path)
		const parent = getEntry(parentPath, state)
		if (!parent) return `touch: cannot touch '${rawPath}': No such file or directory`
		if (parent.type !== 'dir') return `touch: cannot touch '${rawPath}': Not a directory`

		const entry = getEntry(path, state)
		if (entry?.type === 'dir') return `touch: cannot touch '${rawPath}': Is a directory`

		writeEntry(path, entry?.type === 'file' ? entry : { type: 'file', content: '' }, state)
	}

	return ''
}

function resolveMkdir(args: string[], state: TerminalState) {
	if (args.length === 0) return 'mkdir: missing operand'

	for (const rawPath of args) {
		const path = resolvePath(state.cwd ?? HOME, rawPath)
		const parentPath = dirname(path)
		const parent = getEntry(parentPath, state)
		if (!parent) return `mkdir: cannot create directory '${rawPath}': No such file or directory`
		if (parent.type !== 'dir') return `mkdir: cannot create directory '${rawPath}': Not a directory`
		if (getEntry(path, state)) return `mkdir: cannot create directory '${rawPath}': File exists`

		writeEntry(path, { type: 'dir', entries: [] }, state)
	}

	return ''
}

function resolveCopy(args: string[], state: TerminalState) {
	if (args.length < 2) return 'cp: missing file operand'
	if (args.length > 2) return 'cp: extra operand'

	const sourcePath = resolvePath(state.cwd ?? HOME, args[0])
	const targetPath = resolveDestinationPath('cp', sourcePath, args[1], state)
	if ('error' in targetPath) return targetPath.error

	const source = getEntry(sourcePath, state)
	if (!source) return `cp: cannot stat '${args[0]}': No such file or directory`
	if (isAncestorPath(sourcePath, targetPath.path)) return `cp: cannot copy '${args[0]}' to a subdirectory of itself`

	copyEntry(sourcePath, targetPath.path, state)
	return ''
}

function resolveMove(args: string[], state: TerminalState) {
	if (args.length < 2) return 'mv: missing file operand'
	if (args.length > 2) return 'mv: extra operand'

	const sourcePath = resolvePath(state.cwd ?? HOME, args[0])
	const targetPath = resolveDestinationPath('mv', sourcePath, args[1], state)
	if ('error' in targetPath) return targetPath.error

	const source = getEntry(sourcePath, state)
	if (!source) return `mv: cannot stat '${args[0]}': No such file or directory`
	if (sourcePath === '/') return "mv: cannot move '/': Device or resource busy"
	if (isAncestorPath(sourcePath, targetPath.path)) return `mv: cannot move '${args[0]}' to a subdirectory of itself`

	copyEntry(sourcePath, targetPath.path, state)
	removeEntry(sourcePath, state)
	return ''
}

function resolveDate(args: string[]) {
	const now = new Date()
	if (args.length === 0) return now.toString()
	if (args.length === 1 && args[0] === '+%H:%M') {
		return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
	}
	if (args.length === 1 && (args[0] === '+%F' || args[0] === '+%Y-%m-%d')) {
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
	}
	return 'date: unsupported arguments'
}

function resolveGit(args: string[]) {
	if (args.length === 0) {
		return 'usage: git [status|log|branch|config]'
	}

	switch (args[0]) {
		case 'status':
			return 'On branch main\nnothing to commit, working tree clean'
		case 'branch':
			return '* main'
		case 'log':
			return 'commit 7e1f0lio\nAuthor: sheraff <fpellet@ensc.fr>\n\n    Ship a tiny terminal easter egg\n\ncommit c0ffee42\nAuthor: sheraff <fpellet@ensc.fr>\n\n    Keep making the web a little stranger'
		case 'config':
			if (args[1] === 'user.email' || (args[1] === '--get' && args[2] === 'user.email')) return 'fpellet@ensc.fr'
			if (args[1] === 'user.name' || (args[1] === '--get' && args[2] === 'user.name')) return 'Florian Pellet'
			return 'git config: only user.name and user.email are wired up here'
		default:
			return `git: '${args[0]}' is not a git command in this tiny demo`
	}
}

function resolveWhich(args: string[]) {
	if (args.length === 0) return 'which: missing operand'

	return args.map(arg => {
		if (['help', 'cd', 'echo', 'history'].includes(arg)) return `${arg}: shell builtin`
		if (['whoami', 'hostname', 'pwd', 'ls', 'tree', 'cat', 'date', 'git', 'uname', 'id', 'man'].includes(arg)) {
			return `/fake/bin/${arg}`
		}
		return `${arg} not found`
	}).join('\n')
}

function parseCommand(command: string): { args: string[] } | { error: string } {
	const args: string[] = []
	let current = ''
	let quote: '"' | "'" | null = null
	let escaped = false
	let inToken = false

	for (let index = 0; index < command.length; index += 1) {
		const char = command[index]
		if (escaped) {
			current += char
			escaped = false
			inToken = true
			continue
		}

		if (char === '\\' && quote !== "'") {
			escaped = true
			inToken = true
			continue
		}

		if (quote) {
			if (char === quote) quote = null
			else current += char
			inToken = true
			continue
		}

		if (char === '"' || char === "'") {
			quote = char
			inToken = true
			continue
		}

		if ('|&;'.includes(char)) {
			return { error: 'shell pipes and redirects are disabled in this tiny terminal' }
		}

		if (char === '>') {
			if (inToken) {
				args.push(current)
				current = ''
				inToken = false
			}
			if (command[index + 1] === '>') {
				args.push('>>')
				index += 1
			}
			else {
				args.push('>')
			}
			continue
		}

		if (/\s/.test(char)) {
			if (inToken) {
				args.push(current)
				current = ''
				inToken = false
			}
			continue
		}

		current += char
		inToken = true
	}

	if (escaped) current += '\\'
	if (quote) return { error: 'unterminated quote' }
	if (inToken) args.push(current)
	return { args }
}

function resolvePath(cwd: string, input?: string) {
	if (!input || input === '~') return HOME
	if (input.startsWith('~/')) return normalizePath(`${HOME}/${input.slice(2)}`)
	if (input.startsWith('/')) return normalizePath(input)
	return normalizePath(`${cwd}/${input}`)
}

function getEntry(path: string, state: TerminalState) {
	if (state.fs && path in state.fs) return state.fs[path] ?? undefined
	return FILE_SYSTEM[path]
}

function resolveDestinationPath(command: 'cp' | 'mv', sourcePath: string, rawTarget: string, state: TerminalState): { path: string } | { error: string } {
	const requestedPath = resolvePath(state.cwd ?? HOME, rawTarget)
	const target = getEntry(requestedPath, state)
	if (target?.type === 'dir') {
		return { path: joinPath(requestedPath, basename(sourcePath)) }
	}

	const parentPath = dirname(requestedPath)
	const parent = getEntry(parentPath, state)
	if (!parent) return { error: `${command}: cannot create '${rawTarget}': No such file or directory` }
	if (parent.type !== 'dir') return { error: `${command}: cannot create '${rawTarget}': Not a directory` }
	return { path: requestedPath }
}

function writeToFile(path: string, content: string, append: boolean, state: TerminalState) {
	const parentPath = dirname(path)
	const parent = getEntry(parentPath, state)
	if (!parent) return `echo: ${path}: No such file or directory`
	if (parent.type !== 'dir') return `echo: ${parentPath}: Not a directory`

	const existing = getEntry(path, state)
	if (existing?.type === 'dir') return `echo: ${path}: Is a directory`

	writeEntry(path, {
		type: 'file',
		content: append && existing?.type === 'file' ? `${existing.content}${content}` : content,
	}, state)

	return ''
}

function writeEntry(path: string, entry: FsEntry, state: TerminalState) {
	state.fs ??= {}
	state.fs[path] = entry

	if (path === '/') return

	const parentPath = dirname(path)
	const parent = getEntry(parentPath, state)
	if (!parent || parent.type !== 'dir') return

	state.fs[parentPath] = {
		type: 'dir',
		entries: [...new Set([...parent.entries, basename(path)])],
	}
}

function copyEntry(sourcePath: string, targetPath: string, state: TerminalState) {
	const source = getEntry(sourcePath, state)
	if (!source) return

	if (source.type === 'file') {
		writeEntry(targetPath, { type: 'file', content: source.content }, state)
		return
	}

	writeEntry(targetPath, { type: 'dir', entries: [] }, state)
	for (const name of source.entries) {
		copyEntry(joinPath(sourcePath, name), joinPath(targetPath, name), state)
	}
	const copied = getEntry(targetPath, state)
	if (copied?.type === 'dir') {
		state.fs ??= {}
		state.fs[targetPath] = { type: 'dir', entries: [...source.entries] }
	}
}

function removeEntry(path: string, state: TerminalState) {
	const entry = getEntry(path, state)
	if (!entry) return

	if (entry.type === 'dir') {
		for (const name of entry.entries) {
			removeEntry(joinPath(path, name), state)
		}
	}

	state.fs ??= {}
	state.fs[path] = null

	if (path === '/') return

	const parentPath = dirname(path)
	const parent = getEntry(parentPath, state)
	if (!parent || parent.type !== 'dir') return

	state.fs[parentPath] = {
		type: 'dir',
		entries: parent.entries.filter(name => name !== basename(path)),
	}
}

function isAncestorPath(path: string, candidate: string) {
	return candidate === path || candidate.startsWith(`${path}/`)
}

function normalizePath(path: string) {
	const parts: string[] = []
	for (const segment of path.split('/')) {
		if (!segment || segment === '.') continue
		if (segment === '..') parts.pop()
		else parts.push(segment)
	}
	return `/${parts.join('/')}`
}

function joinPath(parent: string, child: string) {
	return parent === '/' ? `/${child}` : `${parent}/${child}`
}

function basename(path: string) {
	if (path === '/') return '/'
	const parts = path.split('/')
	return parts[parts.length - 1] ?? path
}

function dirname(path: string) {
	if (path === '/') return '/'
	const parts = path.split('/').filter(Boolean)
	parts.pop()
	return `/${parts.join('/')}` || '/'
}

function formatLsEntry(name: string, entry: FsEntry, long: boolean) {
	const label = `${name}${entry.type === 'dir' ? '/' : ''}`
	if (!long) return label
	const size = entry.type === 'dir' ? 96 : entry.content.length
	const mode = entry.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--'
	return `${mode} 1 sheraff sheraff ${String(size).padStart(3, ' ')} Mar 29 2026 ${label}`
}
