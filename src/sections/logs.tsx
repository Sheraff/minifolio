import "./logs.css";
import { createSignal, For, onCleanup, onMount } from "solid-js";

export default function Logs() {
	const [logs, setLogs] = createSignal<string[]>([]);
	const [_live, setLive] = createSignal(false);

	let lastEventId: string;
	let sse: EventSource;
	let controller: AbortController;
	let timeout: ReturnType<typeof setTimeout>;
	let retryDelay = 80;

	function startStream() {
		if (lastEventId) {
			const search = new URLSearchParams({ lastEventId });
			sse = new EventSource("/events/stream?" + search);
		} else {
			sse = new EventSource("/events/stream");
		}
		controller = new AbortController();

		sse.addEventListener(
			"log",
			(e) => {
				lastEventId = e.lastEventId;
				setLogs((l) => {
					const max = 200;
					const next =
						l.length < max ? l.slice() : l.slice(l.length - max);
					next.push(e.data);
					return next;
				});
			},
			{ signal: controller.signal },
		);

		sse.addEventListener(
			"error",
			() => {
				setLive(false);
				sse.close();
				controller.abort();
				timeout = setTimeout(startStream, retryDelay);
				retryDelay = Math.min(retryDelay * 2 + Math.random() * 40, 120_000);
			},
			{ signal: controller.signal, once: true },
		);

		sse.addEventListener(
			"open",
			() => {
				retryDelay = 80;
				setLive(true);
			},
			{ signal: controller.signal, once: true },
		);
	}

	onMount(startStream);

	onCleanup(() => {
		if (sse && sse.readyState !== EventSource.CLOSED) sse.close();
		if (controller) controller.abort();
		if (timeout) clearTimeout(timeout);
	});

	return (
		<div class="logs" aria-hidden="true">
			<ul>
				<For each={logs()}>{(value) => <li>{value}</li>}</For>
			</ul>
		</div>
	);
}
