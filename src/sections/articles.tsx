import { createResource, createSignal, For, Match, Show, Switch } from "solid-js"
import * as v from 'valibot'
import './articles.css'

const fetchData = async () => {
	const response = await fetch('/api/articles/tanstack')
	if (!response.ok) {
		throw new Error('Unable to load articles')
	}
	const json = await response.json()

	const schema = v.object({
		articles: v.array(v.object({
			title: v.string(),
			link: v.string(),
			guid: v.string(),
			pubDate: v.string(),
			author: v.string(),
			description: v.string(),
			imageUrl: v.string(),
		}))
	})

	return v.parse(schema, json).articles
}

type Item = Awaited<ReturnType<typeof fetchData>>[number]

export function Articles() {
	const [data] = createResource(fetchData)
	return (
		<section class="article">
			<Switch>
				<Match when={data.loading}>
					<ul />
				</Match>
				<Match when={data()}>
					<ul role="list">
						<For each={data()}>
							{(item) => <Card item={item} />}
						</For>
					</ul>
				</Match>
			</Switch>
		</section>
	)
}

type Char = { real: string, list: string }
const scramble = '&@#=*$%01+{}µ~<>[]'.split('')
const COUNT = 6
function randomString() {
	const arr = new Array(COUNT)
	for (let i = 0; i < COUNT; i++) {
		arr[i] = scramble[Math.floor(Math.random() * scramble.length)]
	}
	return arr.join('\n')
}

function Card(props: { item: Item }) {
	const [desc, setDesc] = createSignal<Char[] | null>(null)
	return (
		<li role="listitem"
			on:mouseenter={() => {
				const segmenter = new Intl.Segmenter('en-US', { granularity: 'grapheme' })
				const desc: Char[] = []
				for (const { segment } of segmenter.segment(props.item.description)) {
					desc.push({
						real: segment,
						list: segment === ' ' ? segment : randomString() + '\n' + segment,
					})
				}
				console.log(desc.map(c => c.real).join(''))
				setDesc(desc)
			}}
		>
			<a href={props.item.link}>
				<figure>
					<img src={props.item.imageUrl} />
					<figcaption>
						{props.item.title}
					</figcaption>
				</figure>
				<div>
					<p>
						<Show when={desc()} fallback={props.item.description}>
							<For each={desc()}>
								{(char, i) => <span
									data-chars={char.list}
									style={{
										'--delay': i(),
										'--count': ((char.list.length - 1) / 2)
									}}
								>
									{char.real}
								</span>}
							</For>
						</Show>
					</p>
				</div>
			</a>
		</li>
	)
}