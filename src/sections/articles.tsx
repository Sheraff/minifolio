import { createResource, For, Match, Switch } from "solid-js"
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
	// const res = v.parse(schema, json).articles
	// res.push(res[0])
	// // res.push(res[0])
	// return res
}

export function Articles() {
	const [data] = createResource(fetchData)
	return (
		<section class="article">
			<Switch>
				<Match when={data.loading}>
					<ul />
				</Match>
				<Match when={data()}>
					<ul role="list" data-even={data()!.length % 2 === 0 ? 'true' : undefined}>
						<For each={data()}>
							{(item) =>
								<li role="listitem">
									<a href={item.link}>
										<img src={item.imageUrl} height="100" />
										<p class="title">{item.title}</p>
										{/* <p class="subtitle">{item.description}</p> */}
									</a>
								</li>
							}
						</For>
					</ul>
				</Match>
			</Switch>
		</section>
	)
}