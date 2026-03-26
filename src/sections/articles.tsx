import { createResource, For, Match, Switch } from "solid-js"
import * as v from 'valibot'

// "articles": [
//     {
//         "title": "5x SSR Throughput: Profiling SSR Hot Paths in TanStack Start",
//         "link": "https://tanstack.com/blog/tanstack-start-5x-ssr-throughput",
//         "guid": "https://tanstack.com/blog/tanstack-start-5x-ssr-throughput",
//         "pubDate": "Tue, 17 Mar 2026 12:00:00 GMT",
//         "author": "Manuel Schiller and Florian Pellet",
//         "description": "How profiling under sustained load uncovered SSR hot paths in TanStack Start and led to a 5.5x throughput gain by removing unnecessary server-side work.",
//         "imageUrl": "https://tanstack.com/blog-assets/tanstack-start-5x-ssr-throughput/header.png"
//     },

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

export function Articles() {
	const [data] = createResource(fetchData)
	return (
		<section>
			<Switch>
				<Match when={data.loading}>
					<ul />
				</Match>
				<Match when={data()}>
					<ul>
						<For each={data()}>
							{(item) =>
								<li>
									<img src={item.imageUrl} height="100" />
									<a>{item.title.slice(0, 40)}</a>
									<p>{item.description.slice(0, 40)}</p>
								</li>
							}
						</For>
					</ul>
				</Match>
			</Switch>
		</section>
	)
}