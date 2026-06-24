import { For } from "solid-js";
import graph from "#/generated/minifolio.graph.json" with { type: "json" };
import "./git.css";

export function GitGraph() {
	if (!graph.commits.length) return <aside />;

	return (
		<aside
			class="git-graph"
			aria-hidden="true"
			style={`--lanes:${graph.lanes};--rows:${graph.rows};`}
		>
			<div class="labels">
				<For each={graph.labels}>
					{(label) => (
						<p style={`--row:${label.row};`}>
							<For each={label.refs}>
								{(ref) => <span data-ref={ref.type}>{ref.name}</span>}
							</For>
						</p>
					)}
				</For>
			</div>
			<div class="edges">
				<For each={graph.edges}>
					{(edge) => (
						<div
							class={edge.type}
							classList={{ "is-main": edge.isMain }}
							style={`--from-lane:${edge.fromLane};--to-lane:${edge.toLane};--from-row:${edge.fromRow};--to-row:${edge.toRow};`}
						/>
					)}
				</For>
			</div>
			<div class="commits">
				<For each={graph.commits}>
					{(commit) => (
						<span
							class={commit.isMain ? "is-main" : undefined}
							style={`--lane:${commit.lane};--row:${commit.row};`}
						/>
					)}
				</For>
			</div>
		</aside>
	);
}
