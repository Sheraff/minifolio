import { createMemo, createResource, For, Match, Switch } from "solid-js"
import * as v from 'valibot'
import './repositories.css'

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

type Item = Awaited<ReturnType<typeof fetchData>>[number]

// TODO: maybe format as "3 weeks ago" instead of exact date
function formatContributionDate(value: string) {
	return new Intl.DateTimeFormat(
		typeof navigator === 'undefined'
			? 'en-US'
			: new Intl.Locale(navigator.language, { numberingSystem: 'latn' }),
		{
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		},
	).format(new Date(value))
}

function RepositoryRow(props: {
	repositories: Array<Item>
	direction: 'ltr' | 'rtl'
}) {
	return (
		<div class="row" data-direction={props.direction} style={{ '--count': props.repositories.length }}>
			<For each={[0, 1]}>
				{(_, index) => (
					<ul role="list" aria-hidden={index() === 1 ? 'true' : undefined}>
						<For each={props.repositories}>
							{(item) =>
								<li role="listitem">
									<a href={`${item.url}/issues?q=author%3Asheraff`}>
										<img src={item.owner.avatarUrl} alt="" width="40" height="40" loading="lazy" />
										<p>{item.nameWithOwner}</p>
										<dl>
											<dt>Contributions</dt>
											<dd>{item.contributionCount}</dd>
											<dt>Last active</dt>
											<dd>
												<time dateTime={item.lastContributedAt}>
													{formatContributionDate(item.lastContributedAt)}
												</time>
											</dd>
										</dl>
									</a>
								</li>
							}
						</For>
					</ul>
				)}
			</For>
		</div>
	)
}

const ROWS = 7

export function Repositories() {
	const [data] = createResource(fetchData)
	const rows = createMemo(() => {
		const repositories = data() ?? []
		const rowCount = Math.min(repositories.length, ROWS)
		const rows: Item[][] = []
		for (let i = 0; i < rowCount; i++) {
			rows.push(repositories.filter((_, index) => index % rowCount === i))
		}
		return rows
	})

	return (
		<section class="repositories">
			<Switch>
				<Match when={data.loading}>
					<For each={Array.from({ length: ROWS }, (_, i) => i)}>
						{() => <div class="row" />}
					</For>
				</Match>
				<Match when={data()}>
					<For each={rows()}>
						{(row, i) => (
							<RepositoryRow repositories={row} direction={i() % 2 === 0 ? "ltr" : "rtl"} />
						)}
					</For>
				</Match>
			</Switch>
		</section>
	)
}
