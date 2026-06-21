import { createEffect, onMount, type Accessor, type Setter } from "solid-js"
import { autocomplete, createTerminalSession, executeTerminalCommand, normalizeTerminalFiles } from './terminal-core'

export { autocomplete, resolveGit, type TerminalAutocompleteState } from './terminal-core'

const RAW_FILES = {
	...import.meta.glob('/fs/**', { eager: true, query: '?raw', import: 'default' }),
	...import.meta.glob('/fs/**/.*', { eager: true, query: '?raw', import: 'default' }),
} as Record<string, string>

const GIT_LOG_URL = `${import.meta.env.BASE_URL}git-log.txt`
const DEV_GIT_LOG = 'git log is generated at build time and is available in production builds.\n'

let gitLogPromise: Promise<string> | undefined

export type HistoryEntry = { command: string, result: string | symbol }

export function InteractiveTerminal(props: {
	history: Accessor<HistoryEntry[]>
	setHistory: Setter<HistoryEntry[]>
	input: Accessor<string>
	setInput: Setter<string>
	setAutocomplete: Setter<string>
}) {
	const state = createWebTerminalSession()
	let pending = Promise.resolve()
	let historyCursor = 0
	let autocompleteGeneration = 0

	createEffect(() => {
		historyCursor = props.history().length
	})

	let textarea: HTMLTextAreaElement | undefined
	onMount(() => {
		if (!getSelection()?.toString().length) textarea?.focus()
		queueAutocomplete(props.input())
		void flushBufferedInput()
	})

	async function flushBufferedInput() {
		const lines = props.input().split('\n')
		if (lines.length <= 1) return

		setInputValue(lines.at(-1)!)
		for (const line of lines.slice(0, -1)) {
			await submitLine(line)
		}
	}

	function setInputValue(value: string) {
		props.setInput(value)
		if (textarea) textarea.value = value
		queueAutocomplete(value)
	}

	function submitLine(value: string) {
		pending = pending.then(() => executeCommand(value))
		return pending
	}

	async function executeCommand(value: string) {
		const input = value.trim()
		if (!input) return

		try {
			const result = await executeTerminalCommand(state, input)
			if (!result) return

			if (result.didClear) {
				props.setHistory([])
				requestAnimationFrame(() => {
					textarea?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
				})
			}
			if (!result.didClear || result.output) props.setHistory(previous => [...previous, { command: result.command, result: result.output }])
		}
		catch (error) {
			props.setHistory(previous => [...previous, { command: input, result: error instanceof Error ? error.message : String(error) }])
		}
		finally {
			queueAutocomplete(props.input())
		}
	}

	function queueAutocomplete(value: string) {
		const generation = ++autocompleteGeneration
		if (!value.trim()) {
			props.setAutocomplete('')
			return
		}

		void autocomplete(value, state).then(suggestion => {
			if (generation === autocompleteGeneration && props.input() === value) props.setAutocomplete(suggestion)
		})
	}

	async function completeInput(value: string) {
		const suggestion = await autocomplete(value, state)
		if (props.input() !== value) return
		if (!suggestion) props.setAutocomplete('')
		if (suggestion) setInputValue(suggestion)
	}

	return (
		<textarea
			ref={textarea}
			name="tty"
			spellcheck={false}
			autocorrect="off"
			autocapitalize="off"
			value={props.input()}
			on:input={e => {
				props.setInput(e.target.value)
				queueAutocomplete(e.target.value)
			}}
			on:keydown={e => {
				if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
					e.preventDefault()
					const value = e.currentTarget.value
					if (value) {
						void submitLine(value)
						setInputValue('')
					}
				} else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
					e.preventDefault()
					void completeInput(e.currentTarget.value)
				} else if (e.key === 'Escape' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
					e.preventDefault()
					e.currentTarget.blur()
					setInputValue('')
				} else if (e.key === 'k' && !e.shiftKey && !e.ctrlKey && e.metaKey && !e.altKey) {
					e.preventDefault()
					props.setHistory([])
				} else if (e.key === 'c' && !e.shiftKey && e.ctrlKey && !e.metaKey && !e.altKey) {
					e.preventDefault()
					props.setHistory([])
					e.currentTarget.blur()
					setInputValue('')
				} else if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
					if (historyCursor > 0) {
						historyCursor--
						setInputValue(props.history()[historyCursor].command)
						e.preventDefault()
					}
				} else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
					if (historyCursor < props.history().length) {
						historyCursor++
						setInputValue(historyCursor === props.history().length ? '' : props.history()[historyCursor].command)
						e.preventDefault()
					}
				}
			}} />
	)
}

function createWebTerminalSession() {
	const prefixes = ['https://florianpellet.com/api/']
	if (import.meta.env.DEV) {
		prefixes.push(location.origin + '/api/')
	}

	return createTerminalSession({
		files: normalizeTerminalFiles(RAW_FILES),
		allowedUrlPrefixes: prefixes,
		loadGitLog: fetchGitLog,
	})
}

async function fetchGitLog() {
	if (import.meta.env.DEV) return DEV_GIT_LOG

	gitLogPromise ??= fetch(GIT_LOG_URL).then(async response => {
		if (!response.ok) throw new Error(`git log asset unavailable: ${response.status}`)
		return response.text()
	})
	return gitLogPromise
}
