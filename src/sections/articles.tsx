import { createSignal, For, Show, Suspense } from "solid-js"
import * as v from 'valibot'
import './articles.css'
import { createServerResource, type ServerResourceType } from "#/createServerResource"

const createArticlesResource = createServerResource(
	"/api/articles/tanstack",
	import.meta.env.SSR && import("#server/api/articles.ts").then((m) => m.fetchTanstackArticles),
	v.pipe(v.object({
		articles: v.array(v.object({
			title: v.string(),
			link: v.string(),
			guid: v.string(),
			pubDate: v.string(),
			author: v.string(),
			description: v.string(),
			imageUrl: v.nullable(v.string()),
		}))
	}), v.transform(r => r.articles))
)

type Item = ServerResourceType<typeof createArticlesResource>[number]

export function Articles() {
	const data = createArticlesResource()
	return (
		<section class="article">
			<Suspense fallback={<ul />}>
				<Show when={data()}>
					{(list) => (
						<ul role="list">
							<For each={list()}>
								{(item) => <Card item={item} />}
							</For>
						</ul>
					)}
				</Show>
			</Suspense>
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
				setDesc(desc)
			}}
		>
			<a href={props.item.link}>
				<figure>
					<Show
						when={props.item.imageUrl}
						fallback={
							<svg viewBox="0 0 100 100" preserveAspectRatio="none" >
								<rect x="0" y="0" width="100" height="100" />
							</svg>
						}
					>
						{(src) => <img src={src()} alt=""/>}
					</Show>
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
