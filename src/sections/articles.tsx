import { createSignal, For, lazy, Show, Suspense } from "solid-js"
import * as v from 'valibot'
import './articles.css'
import { createServerResource, type ServerResourceType } from "#/createServerResource"

const ArticleDescription = lazy(() => import('./articles-lazy'))

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

function Card(props: { item: Item }) {
	const [desc, setDesc] = createSignal<string | null>(null)
	return (
		<li role="listitem"
			on:mouseenter={() => setDesc(props.item.description)}
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
						{(src) => <img src={src()} alt="" loading="lazy" decoding="async"/>}
					</Show>
					<figcaption>
						{props.item.title}
					</figcaption>
				</figure>
				<div>
					<p>
						<Suspense fallback={props.item.description}>
							<Show when={desc()} fallback={props.item.description}>
								{value => <ArticleDescription description={value()} />}
							</Show>
						</Suspense>
					</p>
				</div>
			</a>
		</li>
	)
}
