import { createResource, For, Match, Switch } from "solid-js"
import * as v from 'valibot'

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
		<Switch>
			<Match when={data.loading}>
				<ul />
			</Match>
			<Match when={data()}>
				<ul>
					<For each={data()}>
						{(item) =>
							<li>
								<img src={`https://sheraff.github.io/${item.image!}`} height="20" width="20" />
								<a>{item.title}</a>
							</li>
						}
					</For>
				</ul>
			</Match>
		</Switch>
	)
}