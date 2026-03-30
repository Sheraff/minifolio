import { Time, TimeDifference } from "#/time"
import { createSignal, For, lazy, onCleanup, onMount, Show, Suspense, type Accessor, type Setter } from "solid-js"
import './identity.css'
import type { HistoryEntry } from "#/sections/identity/terminal"

const InteractiveTerminal = lazy(() => import("#/sections/identity/terminal").then(m => ({ default: m.InteractiveTerminal })))

const liveTime = Symbol()

const specialLines = {
	[liveTime]: () => <><Time /><TimeDifference /></>
}

function toOutput(result: HistoryEntry['result']) {
	if (typeof result === 'string') return result
	if (result in specialLines) return specialLines[result as keyof typeof specialLines]()
	throw new Error('Invalid TTY result')
}

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

	const [history, setHistory] = createSignal<HistoryEntry[]>([
		{ command: 'whoami', result: 'sheraff' },
		{ command: 'hostname -f', result: 'florianpellet.com' },
		{ command: 'git config user.email', result: 'fpellet@ensc.fr' },
		{ command: 'date +%H:%M', result: liveTime },
	])

	return (
		<section class="identity" on:click={(e) => {
			setActive(true)
			const area = e.currentTarget.querySelector<HTMLTextAreaElement>('textarea')
			if (area) area.focus()
		}}>
			<dl>
				<For each={history()}>
					{entry => <>
						<dt>{entry.command}</dt>
						<dd>{toOutput(entry.result)}</dd>
					</>}
				</For>
				<Show when={active()} fallback={<div />}>
					<Terminal
						initial={typeof active() === 'string' ? active() as string : ''}
						history={history}
						setHistory={setHistory}
					/>
				</Show>
			</dl>
		</section>
	)
}

function Terminal(props: { initial: string, history: Accessor<HistoryEntry[]>, setHistory: Setter<HistoryEntry[]> }) {
	const [input, setInput] = createSignal(props.initial)

	return (
		<div>
			<Suspense fallback={<textarea value={input()} on:input={e => setInput(e.target.value)} autofocus name="tty" spellcheck={false} autocorrect="off" autocapitalize="off" />}>
				<InteractiveTerminal
					history={props.history}
					setHistory={props.setHistory}
					input={input}
					setInput={setInput}
				/>
			</Suspense>
		</div>
	)
}
