import { streamSSE } from "hono/streaming";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";

let initialized = false;

let pending = Promise.withResolvers<void>();

const history = createLinkedList<string>();
history.push("--init--");

export function publicLog(message: string) {
	if (!initialized) return;
	history.push(message);
	const prev = pending;
	pending = Promise.withResolvers();
	prev.resolve();
}

export function publicLogBroadcast() {
	const app = new Hono();
	initialized = true;

	const interval = setInterval(() => {
		const prev = pending;
		pending = Promise.withResolvers();
		prev.resolve();
	}, 1000);
	interval.unref();

	const streamQuerySchema = v.object({
		lastEventId: v.optional(v.pipe(v.string(), v.toNumber(), v.integer())),
	});

	let counter = 0;

	/**
	 * @see https://hono.dev/docs/helpers/streaming#streamsse
	 */
	app.get("/stream", sValidator("query", streamQuerySchema), async (c) => {
		const visitorNumber = ++counter;
		publicLog(`[http] visitor #${visitorNumber} connected`);
		const { lastEventId } = c.req.valid("query");
		return streamSSE(c, async (stream) => {
			let item = history.get(lastEventId);
			if (!lastEventId || lastEventId !== item.id) {
				await stream.writeSSE({
					data: item.value,
					event: "log",
					id: String(item.id),
				});
			}
			while (!stream.aborted) {
				while (item.next) {
					item = item.next;
					await stream.writeSSE({
						data: item.value,
						event: "log",
						id: String(item.id),
					});
				}
				await pending.promise;
			}
			publicLog(`[http] visitor #${visitorNumber} left`);
		});
	});

	return app;
}

// TODO: how can we send one last message to all streams just before we die?
// (and not block the exit)
// process.on('SIGKILL', () => {
// 	publicLog("--exit--")
// })

function createLinkedList<T>() {
	type Item = { value: T; next: Item | null; id: number };

	const maxSize = 50;

	let id = 0;
	let first: Item;
	let last: Item;

	return {
		push: (value: T) => {
			const item = { value, next: null, id: id++ };
			if (last) last.next = item;
			last = item;
			if (!first) first = item;
			if (id > maxSize) first = first.next!;
		},
		get: (id?: number): Item => {
			if (!id) return first;
			if (id < first.id) return first;
			if (id > last.id) return last;
			let current: Item | null = first;
			while (current && current.id !== id) current = current.next;
			if (current) return current;
			throw new Error("This shouldn't happen");
		},
	};
}
