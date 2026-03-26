import { createResource, For, Match, Switch } from "solid-js"
import * as v from 'valibot'

const fetchData = async () => {
	const response = await fetch('/api/github/repositories')
	if (!response.ok) {
		throw new Error('Unable to load GitHub repositories')
	}
	const json = await response.json()

	const schema = v.object({
		repositories: v.array(v.object({
			name: v.string(),
			nameWithOwner: v.string(),
			url: v.string(),
			description: v.union([v.null(), v.string()]),
			imageUrl: v.string(),
			imageSource: v.union([v.literal('owner'), v.literal('repository')]),
			contributionCount: v.number(),
			lastContributedAt: v.string(),
			lastPullRequest: v.union([v.null(), v.object({
				title: v.string(),
				url: v.string(),
				occurredAt: v.string(),
			})]),
			owner: v.object({
				login: v.string(),
				avatarUrl: v.string(),
			}),
		}))
	})

	return v.parse(schema, json).repositories.filter(r => r.lastPullRequest)
}

export function Repositories() {
	const [data] = createResource(fetchData)
	return (
		<section class="repositories">
			<Switch>
				<Match when={data.loading}>
					<ul />
				</Match>
				<Match when={data()}>
					<ul>
						<For each={data()}>
							{(item) =>
								<li>
									<img src={item.owner.avatarUrl} height="20" width="20" />
									<a href={`https://github.com/${item.nameWithOwner}/issues?q=author%3Asheraff`}>{item.nameWithOwner}</a>
									{/* <a>{item.lastPullRequest!.title}</a> */}
									<span> ({item.contributionCount})</span>
								</li>
							}
						</For>
					</ul>
				</Match>
			</Switch>
		</section>
	)
}