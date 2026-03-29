import { Time, TimeDifference } from "#/time"
import { createSignal, For, onCleanup, onMount, Show } from "solid-js"
import './identity.css'
import asciiMask from '#/svg/mask.txt?raw'

export function Identity() {
	const [active, setActive] = createSignal<boolean | string>(false)

	const controller = new AbortController()
	onMount(() => window.addEventListener('keydown', (e) => {
		if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
			if (!active()) {
				setActive(e.key)
			} else {
				const area = document.querySelector<HTMLTextAreaElement>('textarea')
				if (area) area.focus()
			}
		}
	}, { signal: controller.signal }))
	onCleanup(() => controller.abort())

	return (
		<section class="identity" on:click={(e) => {
			setActive(true)
			const area = e.currentTarget.querySelector<HTMLTextAreaElement>('textarea')
			if (area) area.focus()
		}}>
			<dl>
				<dt>whoami</dt>
				<dd>sheraff</dd>
				<dt>hostname -f</dt>
				<dd>florianpellet.com</dd>
				<dt>git config user.email</dt>
				<dd>fpellet@ensc.fr</dd>
				<dt>date +%H:%M</dt>
				<dd><Time /><TimeDifference /></dd>
				<Show when={active()} fallback={<div />}>
					<Terminal initial={typeof active() === 'string' ? active() as string : ''} />
				</Show>
				{/* <dt>|</dt> */}
				{/* Staff frontend engineer */}
				{/* he/him */}
				{/* Europe/Paris */}
			</dl>
		</section>
	)
}

function Terminal(props: { initial: string }) {
	const state: TerminalState = {}
	const [history, setHistory] = createSignal<Array<{ command: string, result: string }>>([])

	return (
		<>
			<For each={history()}>
				{entry => <>
					<dt>{entry.command}</dt>
					<dd>{entry.result}</dd>
				</>}
			</For>
			<div>
				<textarea value={props.initial} autofocus name="tty" on:keydown={e => {
					if (e.key === "Enter") {
						e.preventDefault()
						const value = e.currentTarget.value
						if (value) {
							const entry = resolveCommand(e.currentTarget.value, state)
							if (entry.clear) setHistory([])
							else setHistory(p => [...p, entry])
							e.currentTarget.value = ''
						}
					} else if (e.key === 'Tab') {
						e.preventDefault()
						const suggestion = autocomplete(e.currentTarget.value, state)
						if (suggestion) e.currentTarget.value = suggestion
					} else if (e.key === 'Escape') {
						e.currentTarget.blur()
						e.currentTarget.value = ''
					} else if (e.key === 'k' && e.metaKey) {
						e.preventDefault()
						setHistory([])
					}
				}} />
			</div>
		</>
	)
}

type TerminalState = {
	cwd?: string
	previousCwd?: string
	history?: string[]
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
	'exit',
] as const

const GIT_SUBCOMMANDS = ['branch', 'config', 'log', 'status'] as const

const PATH_COMMANDS = new Set(['cd', 'ls', 'tree', 'cat'])

const BASHRC = Object.entries(ALIASES)
	.map(([name, value]) => `alias ${name}='${value}'`)
	.join('\n')

const CLEAR_SIGNAL = '__clear__'

const FILE_SYSTEM: Record<string, FsEntry> = {
	'/': { type: 'dir', entries: ['etc', 'home'] },
	'/etc': { type: 'dir', entries: ['hostname', 'motd'] },
	'/etc/hostname': { type: 'file', content: 'florianpellet.com' },
	'/etc/motd': { type: 'file', content: 'Welcome to the tiny fake terminal. Type help and poke around.' },
	'/home': { type: 'dir', entries: ['sheraff'] },
	'/home/sheraff': { type: 'dir', entries: ['.bashrc', 'about.txt', 'contact.txt', 'now.txt', 'projects', 'stack.txt', 'documents'] },
	'/home/sheraff/.bashrc': { type: 'file', content: BASHRC },
	'/home/sheraff/about.txt': { type: 'file', content: 'Florian Pellet\nStaff frontend engineer.\nI\'m a web worker.' },
	'/home/sheraff/contact.txt': { type: 'file', content: 'mail: fpellet@ensc.fr\ngithub: github.com/sheraff\nbluesky: sheraff.bsky.social' },
	'/home/sheraff/now.txt': { type: 'file', content: 'Currently shipping this minifolio.\nTimezone: Europe/Paris.\nStatus: caffeinated.' },
	'/home/sheraff/projects': { type: 'dir', entries: ['experiments.txt', 'minifolio.txt'] },
	'/home/sheraff/projects/experiments.txt': { type: 'file', content: 'A drawer full of prototypes, visuals, and half-serious ideas.' },
	'/home/sheraff/projects/minifolio.txt': { type: 'file', content: 'This site. SolidJS on the front, a tiny bit of terminal mischief on the side.' },
	'/home/sheraff/documents': { type: 'dir', entries: ['mask.txt'] },
	'/home/sheraff/documents/mask.txt': { type: 'file', content: asciiMask },
	'/home/sheraff/stack.txt': { type: 'file', content: 'TypeScript\nSolidJS\nNode.js\nCSS\nPatience' },
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

	if (effectiveCommand === 'git') {
		const target = endsWithSpace ? '' : rawTokens[rawTokens.length - 1]
		const shouldCompleteSubcommand = rawTokens.length === 1 || (rawTokens.length === 2 && !rawTokens[1].startsWith('-')) || (rawTokens.length === 1 && endsWithSpace)
		if (shouldCompleteSubcommand) {
			const match = findFirstMatch(GIT_SUBCOMMANDS, target)
			if (!match || match === target) return ''
			return replaceLastToken(command, `${match} `, endsWithSpace)
		}
	}

	if (!PATH_COMMANDS.has(effectiveCommand)) return ''

	const target = endsWithSpace ? '' : rawTokens[rawTokens.length - 1]
	if (target.startsWith('-')) return ''

	const directoriesOnly = effectiveCommand === 'cd'
	const allowHidden = target.split('/').at(-1)?.startsWith('.') === true || expandedTokens.slice(1).some(arg => arg.startsWith('-') && arg.includes('a'))
	const completion = completePath(target, state.cwd ?? HOME, { directoriesOnly, allowHidden })
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
	const result = resolveBuiltin(name, args, state)
	if (result === CLEAR_SIGNAL) {
		return { command: input, result: '', clear: true }
	}
	return { command: input, result, clear: false }
}

function resolveBuiltin(name: string, args: string[], state: TerminalState) {
	switch (name) {
		case 'help':
			return 'Supported: help, clear, whoami, hostname, pwd, cd, ls, tree, cat, echo, date, git, uname, id, which, history, man\nAliases: ll, portfolio\nAlso recognized in a mostly joke capacity: sudo, rm, mkdir, touch, curl, exit'
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
			return args.map(arg => arg === '$PWD' ? (state.cwd ?? HOME) : arg).join(' ')
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
		case 'touch':
			return `${name}: read-only filesystem`
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

function completePath(fragment: string, cwd: string, options: { directoriesOnly: boolean, allowHidden: boolean }) {
	const slashIndex = fragment.lastIndexOf('/')
	const parentInput = slashIndex === -1 ? '' : fragment.slice(0, slashIndex)
	const partialName = slashIndex === -1 ? fragment : fragment.slice(slashIndex + 1)
	const directoryPath = resolvePath(cwd, parentInput || '.')
	const directory = FILE_SYSTEM[directoryPath]
	if (!directory || directory.type !== 'dir') return ''

	const match = [...directory.entries]
		.filter(name => options.allowHidden || !name.startsWith('.'))
		.filter(name => !options.directoriesOnly || FILE_SYSTEM[joinPath(directoryPath, name)].type === 'dir')
		.sort((left, right) => left.localeCompare(right))
		.find(name => name.startsWith(partialName))

	if (!match) return ''

	const matchedPath = joinPath(directoryPath, match)
	const suffix = FILE_SYSTEM[matchedPath].type === 'dir' ? '/' : ' '
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
	const entry = FILE_SYSTEM[target]
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
		.map((path, index) => formatLs(path, targets[index], { showAll, long, showHeader: paths.length > 1 }))
		.join('\n\n')
}

function formatLs(path: string, rawTarget: string | undefined, options: { showAll: boolean, long: boolean, showHeader: boolean }) {
	const entry = FILE_SYSTEM[path]
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
			return formatLsEntry(name, FILE_SYSTEM[joinPath(path, name)], true)
		}))
	}
	else {
		lines.push(names.map(name => {
			if (name === '.' || name === '..') return `${name}/`
			return formatLsEntry(name, FILE_SYSTEM[joinPath(path, name)], false)
		}).join('  '))
	}

	return lines.join('\n')
}

function resolveTree(args: string[], state: TerminalState) {
	if (args.length > 1) return 'tree: too many arguments'
	const path = resolvePath(state.cwd ?? HOME, args[0])
	const entry = FILE_SYSTEM[path]
	if (!entry) return `tree: ${args[0] ?? path}: No such file or directory`

	const rootLabel = path === '/' ? '/' : basename(path)
	if (entry.type === 'file') return rootLabel

	return [rootLabel, ...walkTree(path, '', entry.entries)].join('\n')
}

function walkTree(path: string, prefix: string, names: string[]): string[] {
	const visibleNames = [...names].sort((left, right) => left.localeCompare(right)).filter(name => !name.startsWith('.'))
	return visibleNames.flatMap((name, index) => {
		const childPath = joinPath(path, name)
		const child = FILE_SYSTEM[childPath]
		const last = index === visibleNames.length - 1
		const branch = `${prefix}${last ? '`-- ' : '|-- '}${name}${child.type === 'dir' ? '/' : ''}`
		if (child.type !== 'dir') return [branch]
		return [branch, ...walkTree(childPath, `${prefix}${last ? '    ' : '|   '}`, child.entries)]
	})
}

function resolveCat(args: string[], state: TerminalState) {
	if (args.length === 0) return 'cat: missing operand'

	return args.map(rawPath => {
		const path = resolvePath(state.cwd ?? HOME, rawPath)
		const entry = FILE_SYSTEM[path]
		if (!entry) return `cat: ${rawPath}: No such file or directory`
		if (entry.type === 'dir') return `cat: ${rawPath}: Is a directory`
		return entry.content
	}).join('\n')
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

	for (const char of command) {
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

		if ('|&;<>'.includes(char)) {
			return { error: 'shell pipes and redirects are disabled in this tiny terminal' }
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

function formatLsEntry(name: string, entry: FsEntry, long: boolean) {
	const label = `${name}${entry.type === 'dir' ? '/' : ''}`
	if (!long) return label
	const size = entry.type === 'dir' ? 96 : entry.content.length
	const mode = entry.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--'
	return `${mode} 1 sheraff sheraff ${String(size).padStart(3, ' ')} Mar 29 2026 ${label}`
}
