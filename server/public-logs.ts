import { streamSSE } from "hono/streaming";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { getConnInfo } from "@hono/node-server/conninfo";
import { hash, randomBytes } from "node:crypto";

let initialized = false;

let pending = Promise.withResolvers<void>();

const history = createLinkedList<string>();
history.push("--init--");

let queued = false;
export function publicLog(message: string) {
	if (!initialized) return;
	history.push(message);
	if (queued) return;
	queued = true;
	setImmediate(() => {
		queued = false;
		const prev = pending;
		pending = Promise.withResolvers();
		prev.resolve();
	}).unref();
}

export function publicLogBroadcast() {
	const app = new Hono();
	initialized = true;

	/**
	 * this is not a ping, it's just to make sure we regularly flush
	 * streams that have been aborted between logs.
	 * we don't need to ping, it's ok if some streams die, client
	 * will reconnect if they need to.
	 */
	const interval = setInterval(() => {
		const prev = pending;
		pending = Promise.withResolvers();
		prev.resolve();
	}, 1000);
	interval.unref();

	const streamQuerySchema = v.object({
		lastEventId: v.optional(v.pipe(v.string(), v.toNumber(), v.integer())),
	});

	let visitorCount = 0;
	let activeStreams = 0;
	const MAX_STREAMS = 60;
	const perClientStreams = new Map<string, number>();
	const MAX_PER_CLIENT = 4;

	const clientKeySalt = randomBytes(32).toString("hex");

	/**
	 * @see https://hono.dev/docs/helpers/streaming#streamsse
	 */
	app.get("/stream", sValidator("query", streamQuerySchema), async (c) => {
		if (activeStreams >= MAX_STREAMS) return c.text("too many streams", 503);

		const remoteAddress = getConnInfo(c).remote.address ?? "unknown";
		const clientKey = hash("sha256", clientKeySalt + remoteAddress, {
			outputEncoding: "base64",
		});

		{
			const clientCount = perClientStreams.get(clientKey) ?? 0;
			if (clientCount >= MAX_PER_CLIENT)
				return c.text("too many streams", 429);
			perClientStreams.set(clientKey, clientCount + 1);
			activeStreams++;
		}

		const visitorNumber = ++visitorCount;
		publicLog(`[http] visitor #${visitorNumber} connected`);

		const { lastEventId } = c.req.valid("query");

		return streamSSE(c, async (stream) => {
			try {
				let item = history.get(lastEventId);
				if (lastEventId === undefined || lastEventId !== item.id) {
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
			} finally {
				publicLog(`[http] visitor #${visitorNumber} left`);
				activeStreams--;
				const clientCount = perClientStreams.get(clientKey);
				if (!clientCount || clientCount === 1) {
					perClientStreams.delete(clientKey);
				} else {
					perClientStreams.set(clientKey, clientCount - 1);
				}
			}
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

	const maxSize = 200;

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
