import { createResource, For, Match, Switch } from "solid-js"
import * as v from 'valibot'

const fetchData = async () => {
	const response = await fetch('/api/github/contributions')
	if (!response.ok) {
		throw new Error('Unable to load GitHub contributions')
	}
	const json = await response.json()
	const schema = v.object({
		total: v.object({
			lastYear: v.number()
		}),
		contributions: v.array(v.object({
			date: v.string(),
			count: v.number(),
			level: v.number()
		}))
	})
	return v.parse(schema, json)
}

export function Contributions() {
	const [data] = createResource(fetchData)

	return (
		<Switch>
			<Match when={data.error}>
				<></>
			</Match>
			<Match when={data.loading}>
				<hr />
				<section class="contributions">
					<div class="graph" />
				</section>
			</Match>
			<Match when={data()}>
				<hr />
				<section class="contributions">
					<div class="graph">
						<For each={data()!.contributions}>
							{(item) =>
								<span style={{ '--level': item.level }} />
							}
						</For>
					</div>
					<p class="total">
						{data()!.total.lastYear}
					</p>
				</section>
			</Match>
		</Switch>
	)
}
