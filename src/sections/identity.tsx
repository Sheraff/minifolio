import { Time, TimeDifference } from "#/time"
import { createSignal, For, onCleanup, onMount, Show } from "solid-js"
import './identity.css'

export function Identity() {
	const [active, setActive] = createSignal<boolean | string>(false)

	const controller = new AbortController()
	onMount(() => window.addEventListener('keydown', (e) => {
		if (!active() && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
			setActive(e.key)
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
				{/* <Show when={active()}>
					<Terminal initial={typeof active() === 'string' ? active() as string : ''} />
				</Show> */}
				{/* <dt>|</dt> */}
				{/* Staff frontend engineer */}
				{/* he/him */}
				{/* Europe/Paris */}
			</dl>
		</section>
	)
}

function Terminal(props: { initial: string }) {
	const state = {}
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
						setHistory(p => [...p, resolveCommand(e.currentTarget.value, state)])
						e.currentTarget.value = ''
					}
				}} />
			</div>
		</>
	)
}

function resolveCommand(command: string, state: {}) {
	// TODO: compute result, and mutate state
	const result = 'hello'
	return { command, result }
}