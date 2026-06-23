import { SSEStreamingApi, streamSSE } from "hono/streaming";
import { sValidator } from "@hono/standard-validator";
import { Context, Hono } from "hono";
import * as v from "valibot";
import { getConnInfo } from "@hono/node-server/conninfo";
import { hash, randomBytes } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { simpleUserAgent } from "./utils/simple-ua.ts";
import type { ShutdownScope } from "./utils/shutdown.ts";
import { isIP } from "node:net";
import { dirname, resolve } from "node:path";

let initialized = false;

let pending = Promise.withResolvers<void>();

const PUBLIC_LOG_HISTORY_VERSION = 2;
const PUBLIC_LOG_HISTORY_PATH = resolve("logs/public-logs.json");

const persistedHistorySchema = v.pipe(
	v.string(),
	v.parseJson(),
	v.object({
		version: v.literal(PUBLIC_LOG_HISTORY_VERSION),
		firstId: v.pipe(
			v.number(),
			v.integer(),
			v.maxValue(Number.MAX_SAFE_INTEGER),
		),
		entries: v.array(v.string()),
	}),
);

type PersistedHistory = v.InferOutput<typeof persistedHistorySchema>;

const history = createLinkedList<string>(loadPersistedHistory());

let queued = false;
export function publicLog(message: string) {
	if (!initialized) return;
	history.push(message);
	if (queued) return;
	queued = true;
	setImmediate(() => {
		queued = false;
		wakeStreams();
	}).unref();
}

function wakeStreams() {
	const prev = pending;
	pending = Promise.withResolvers();
	prev.resolve();
}

export function publicLogBroadcast(parentScope: ShutdownScope) {
	const app = new Hono();
	initialized = true;
	history.push("--init--");
	const scope = parentScope.child("sse log streams", {
		close: (ctx) => {
			wakeStreams();
			void ctx.childrenClosed.then(() => {
				savePersistedHistory();
				scope.done();
			});
		},
	});

	// /**
	//  * this is not a ping, it's just to make sure we regularly flush
	//  * streams that have been aborted between logs.
	//  * we don't need to ping, it's ok if some streams die, client
	//  * will reconnect if they need to.
	//  */
	// const interval = setInterval(() => {
	// 	const prev = pending;
	// 	pending = Promise.withResolvers();
	// 	prev.resolve();
	// }, 1000);
	// interval.unref();

	const streamQuerySchema = v.object({
		lastEventId: v.optional(v.pipe(v.string(), v.toNumber(), v.integer())),
	});

	const clientIds = new Set<string>();
	let activeStreams = 0;
	const MAX_STREAMS = 80;
	const perClientStreams = new Map<string, number>();
	const MAX_PER_CLIENT = 3;
	const MAX_STREAM_AGE_MS = 5 * 60 * 1000;

	const clientKeySalt = randomBytes(32).toString("hex");

	/**
	 * @see https://hono.dev/docs/helpers/streaming#streamsse
	 */
	app.get("/stream", sValidator("query", streamQuerySchema), async (c) => {
		if (scope.closing) {
			c.header("Retry-After", "20");
			return c.text("shutting down", 503);
		}

		if (activeStreams >= MAX_STREAMS) {
			publicLog(`[WARN] too many streams`);
			return c.text("too many streams", 503);
		}

		const remoteAddress = getClientAddress(c) ?? "unknown";
		const clientKey = hash("sha256", clientKeySalt + "\0" + remoteAddress, {
			outputEncoding: "base64",
		});

		{
			const clientCount = perClientStreams.get(clientKey) ?? 0;
			if (clientCount >= MAX_PER_CLIENT) {
				publicLog(`[WARN] too many streams`);
				return c.text("too many streams", 429);
			}
			perClientStreams.set(clientKey, clientCount + 1);
			activeStreams++;
		}

		const ua = simpleUserAgent(c.req.header("User-Agent"));

		if (!clientIds.has(clientKey)) {
			clientIds.add(clientKey);
			publicLog(`[http] ${ua} connected`);
		}
		publicLog(`[http] new ${ua} session`);

		const { lastEventId } = c.req.valid("query");

		return streamSSE(c, async (stream) => {
			const timeout = setTimeout(() => stream.abort(), MAX_STREAM_AGE_MS);
			timeout.unref();
			const streamScope = scope.child("sse stream", {
				force: () => stream.abort(),
			});
			const abortPromise = abortPromiseFromStream(stream);
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
					if (streamScope.closing || scope.closing) break;
					await Promise.race([abortPromise, pending.promise]);
				}
			} finally {
				activeStreams--;
				clearTimeout(timeout);
				streamScope.done();
				if (!scope.closing) {
					publicLog(`[http] closed ${ua} session`);
				}
				const clientCount = perClientStreams.get(clientKey);
				if (!clientCount || clientCount === 1) {
					perClientStreams.delete(clientKey);
					if (!scope.closing) {
						publicLog(`[http] ${ua} left`);
					}
					clientIds.delete(clientKey);
				} else {
					perClientStreams.set(clientKey, clientCount - 1);
				}
			}
		});
	});

	return app;
}

function abortPromiseFromStream(stream: SSEStreamingApi): Promise<void> {
	return new Promise((resolve) => {
		stream.onAbort(resolve);
	});
}

function getClientAddress(c: Context) {
	const forwardedFor = c.req.header("x-forwarded-for");
	const forwardedAddress = forwardedFor?.split(",", 1)[0]?.trim();

	if (forwardedAddress && isIP(forwardedAddress)) {
		return forwardedAddress;
	}

	return getConnInfo(c).remote.address ?? "unknown";
}

function loadPersistedHistory(): Omit<PersistedHistory, "version"> {
	if (!existsSync(PUBLIC_LOG_HISTORY_PATH)) return { firstId: 0, entries: [] };

	try {
		return v.parse(
			persistedHistorySchema,
			readFileSync(PUBLIC_LOG_HISTORY_PATH, "utf8"),
		);
	} catch (cause) {
		console.error(new Error("Failed to restore public logs", { cause }));
	}

	return { firstId: 0, entries: [] };
}

function savePersistedHistory() {
	try {
		mkdirSync(dirname(PUBLIC_LOG_HISTORY_PATH), { recursive: true });

		const temporaryPath = `${PUBLIC_LOG_HISTORY_PATH}.${process.pid}.tmp`;
		writeFileSync(
			temporaryPath,
			JSON.stringify(
				{
					version: PUBLIC_LOG_HISTORY_VERSION,
					...history.snapshot(),
				},
				null,
				"\t",
			) + "\n",
		);
		renameSync(temporaryPath, PUBLIC_LOG_HISTORY_PATH);
	} catch (cause) {
		console.error(new Error("Failed to persist public logs", { cause }));
	}
}

function createLinkedList<T>(init?: { entries: T[]; firstId: number }) {
	type Item = { value: T; next: Item | null; id: number };

	const maxSize = 200;

	let nextId = init?.firstId ?? 0;
	let size = 0;
	let first: Item | undefined;
	let last: Item | undefined;

	function pushItem(value: T) {
		const id = nextId;
		const item = { value, next: null, id };
		if (last) last.next = item;
		last = item;
		first ??= item;
		nextId = Math.max(nextId, id + 1);
		size++;

		if (size > maxSize) {
			first = first.next!;
			size--;
		}
	}

	if (init?.entries) for (const entry of init.entries) pushItem(entry);

	return {
		push: pushItem,
		snapshot: () => {
			const entries: T[] = [];
			let current = first;
			while (current) {
				entries.push(current.value);
				current = current.next ?? undefined;
			}
			return { firstId: first?.id ?? nextId, entries };
		},
		get: (id?: number): Item => {
			if (!first || !last) throw new Error("Public log history is empty");
			if (id === undefined) return first;
			if (id < first.id) return first;
			if (id > last.id) return last;
			let current: Item | null = first;
			while (current && current.id !== id) current = current.next;
			if (current) return current;
			throw new Error("This shouldn't happen");
		},
	};
}
