import { Time, TimeDifference } from "#/time"
import { createSignal, For, lazy, onCleanup, onMount, Show, Suspense } from "solid-js"
import './identity.css'
import { type HistoryEntry } from "#/sections/identity/terminal"

const InteractiveTerminal = lazy(() => import("#/sections/identity/terminal").then(m => ({ default: m.InteractiveTerminal })))

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
			</dl>
		</section>
	)
}

function Terminal(props: { initial: string }) {
	const [history, setHistory] = createSignal<HistoryEntry[]>([])

	return (
		<>
			<For each={history()}>
				{entry => <>
					<dt>{entry.command}</dt>
					<dd>{entry.result}</dd>
				</>}
			</For>
			<div>
				<Suspense fallback={<textarea value={props.initial} autofocus name="tty" />}>
					<InteractiveTerminal
						history={history}
						setHistory={setHistory}
						initial={props.initial}
					/>
				</Suspense>
			</div>
		</>
	)
}
