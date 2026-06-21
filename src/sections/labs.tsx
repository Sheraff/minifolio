import { createSignal, For, lazy, Show, Suspense } from "solid-js";
import * as v from "valibot";
import "./labs.css";
import {
	createServerResource,
	type ServerResourceType,
} from "#/createServerResource";

const Animator = lazy(() => import("./labs-lazy"));

const createProjectsResource = createServerResource(
	"/api/projects",
	import.meta.env.SSR &&
		import("#server/api/projects.ts").then((m) => m.fetchLabProjects),
	v.pipe(
		v.array(
			v.object({
				route: v.string(),
				url: v.string(),
				title: v.string(),
				description: v.union([v.null(), v.string()]),
				tags: v.array(v.string()),
				image: v.union([v.null(), v.string()]),
				git: v.object({
					lastModified: v.number(),
					firstAdded: v.number(),
				}),
			}),
		),
		v.transform((r) => r.filter((i) => i.image)),
	),
);

export function Labs() {
	const data = createProjectsResource();
	return (
		<section class="labs">
			<Suspense fallback={<ul />}>
				<Show when={data()}>{(list) => <List list={list()} />}</Show>
			</Suspense>
		</section>
	);
}

const COUNT = 8;

function List(props: {
	list: ServerResourceType<typeof createProjectsResource>;
}) {
	const [current, setCurrent] = createSignal(
		Array.from(
			{ length: Math.min(COUNT, props.list.length - 1) },
			(_, i) => i,
		),
	);
	const [swap, setSwap] = createSignal<null | { from: number; to: number }>(
		null,
	);
	const [hold, setHold] = createSignal(-1);
	let ref: HTMLUListElement | undefined;
	const [start, setStart] = createSignal(false);
	setTimeout(() => setStart(true), 6000);

	return (
		<ul role="list" ref={ref}>
			<For each={current()}>
				{(i, index) => {
					const item = props.list[i];
					const insert = () => swap()?.from === i;
					return (
						<>
							<Show when={index() > 0}>
								<div data-separator />
							</Show>
							<li
								role="listitem"
								class={
									insert() ? "swap" : hold() === i ? "hold" : undefined
								}
								on:mouseenter={() => setHold(i)}
								on:mouseleave={() => setHold(-1)}
							>
								<div class="frame">
									<Card item={item} />
									<Show when={insert()}>
										<Card item={props.list[swap()!.to]} />
									</Show>
								</div>
								<Show when={insert()}>
									<div class="wheels">
										<span />
										<span />
										<span />
										<span />
										<span />
									</div>
								</Show>
							</li>
						</>
					);
				}}
			</For>
			<Suspense>
				<Show when={start()}>
					<Animator
						ref={ref}
						length={props.list.length}
						current={current}
						hold={hold}
						swap={swap}
						setCurrent={setCurrent}
						setSwap={setSwap}
					/>
				</Show>
			</Suspense>
		</ul>
	);
}

function Card(props: {
	item: ServerResourceType<typeof createProjectsResource>[number];
}) {
	return (
		<a href={`https://sheraff.github.io${props.item.url}`}>
			<img src={`https://sheraff.github.io${props.item.image!}`} alt="" />
			<div>
				<p>{props.item.title}</p>
			</div>
		</a>
	);
}
