import { createResource, For, Match, Show, Switch } from "solid-js"
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
					<ul role="list">
						<For each={data()}>
							{(item, index) =>
								<>
									<Show when={index() > 0}>
										<div data-separator />
									</Show>
									<li role="listitem">
										<a href={`https://sheraff.github.io/vite-labs/${item.route}`}>
											<img src={`https://sheraff.github.io/${item.image!}`} />
											<p>{item.title}</p>
										</a>
									</li>
								</>
							}
						</For>
					</ul>
				</Match>
			</Switch>
		</section>
	)
}