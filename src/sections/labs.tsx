import { createResource, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import * as v from 'valibot'
import './labs.css'

const fetchData = async () => {
	const response = await fetch('/api/projects')
	if (!response.ok) {
		throw new Error('Unable to load projects')
	}
	const json = await response.json()

	const schema = v.array(v.object({
		route: v.string(),
		url: v.string(),
		title: v.string(),
		description: v.union([v.null(), v.string()]),
		tags: v.array(v.string()),
		image: v.union([v.null(), v.string()]),
		git: v.object({
			lastModified: v.number(),
			firstAdded: v.number()
		})
	}))

	return v.parse(schema, json).filter(i => i.image)
}

export function Labs() {
	const [data] = createResource(fetchData)
	return (
		<section class="labs">
			<Switch>
				<Match when={data.loading}>
					<ul />
				</Match>
				<Match when={data()}>
					{(list) => <List list={list()} />}
				</Match>
			</Switch>
		</section>
	)
}

const COUNT = 8

function List(props: { list: Awaited<ReturnType<typeof fetchData>> }) {
	const [current, setCurrent] = createSignal(Array.from({ length: Math.min(COUNT, props.list.length - 1) }, (_, i) => i))
	const [swap, setSwap] = createSignal<null | { from: number, to: number }>(null)
	const [hold, setHold] = createSignal(-1)
	let last = -1
	let ref: HTMLUListElement | undefined
	const controller = new AbortController()

	const interval = setInterval(() => {
		if (!ref || swap()) return

		// resolve after animation
		setTimeout(() => {
			const pair = swap()
			if (!pair) return
			const { from, to } = pair
			setSwap(null)
			setCurrent(prev => {
				const next = [...prev]
				const index = next.indexOf(from)
				next[index] = to
				return next
			})
		}, 3300)

		// find swap pair
		let from: number
		do {
			from = current()[Math.floor(Math.random() * current().length)]
		} while (from === hold() || from === last)
		let to: number
		do {
			to = Math.floor(Math.random() * props.list.length)
		} while (current().includes(to))

		// start swap
		last = to
		setSwap({ from, to })
	}, 6000)

	onCleanup(() => {
		clearInterval(interval)
		controller.abort()
	})

	return <ul role="list" ref={ref}>
		<For each={current()}>
			{(i, index) => {
				const item = props.list[i]
				const insert = () => swap()?.from === i
				return (
					<>
						<Show when={index() > 0}>
							<div data-separator />
						</Show>
						<li
							role="listitem"
							class={insert() ? 'swap' : hold() === i ? 'hold' : undefined}
							on:mouseenter={() => setHold(i)}
							on:mouseleave={() => setHold(-1)}
						>
							<div class="frame">
								<Card item={item} />
								<Show when={insert()}>
									<Card item={props.list[swap()!.to]} />
								</Show>
							</div>
							<Show when={insert()}>
								<div class="wheels">
									<span />
									<span />
									<span />
									<span />
									<span />
								</div>
							</Show>
						</li>
					</>
				)
			}}
		</For>
	</ul>
}

function Card(props: { item: Awaited<ReturnType<typeof fetchData>>[number] }) {
	return (
		<a href={`https://sheraff.github.io${props.item.url}`}>
			<img src={`https://sheraff.github.io${props.item.image!}`} />
			<div>
				<p>{props.item.title}</p>
			</div>
		</a>
	)
}