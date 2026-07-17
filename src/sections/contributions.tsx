import { For, Show, Suspense } from "solid-js";
import * as v from "valibot";
import "./contributions.css";
import { createServerResource } from "#/createServerResource";

const createGithubContributionResource = createServerResource(
	"/api/github/contributions",
	v.object({
		total: v.object({
			lastYear: v.number(),
		}),
		contributions: v.array(
			v.object({
				date: v.string(),
				count: v.number(),
				level: v.number(),
			}),
		),
	})
)

export function Contributions() {
	const data = createGithubContributionResource();

	return (
		<Suspense
			fallback={
				<section class="contributions">
					<div class="graph" />
				</section>
			}
		>
			<Show when={data()}>
				{(value) => (
					<section class="contributions">
						<div class="graph">
							<For each={value().contributions}>
								{(item) => <span style={{ "--level": item.level }} />}
							</For>
						</div>
						<p class="total">{value().total.lastYear}</p>
					</section>
				)}
			</Show>
		</Suspense>
	);
}
