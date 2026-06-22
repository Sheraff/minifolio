import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";
import { prerenderClientIndex } from "./prerender.ts";
import { createMiddleware } from "hono/factory";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import type { HttpServer } from "vite";
import type { ServerType } from "@hono/node-server";
import { publicLog } from "./public-logs.ts";

const REGEN_DELAY = 6 * 60 * 60 * 1000 // 6 hours

export function ogImage(imageDir: string) {
	return serveStatic({
		root: imageDir,
		rewriteRequestPath: (requestPath, c) => {
			if (requestPath !== "/og.png") return requestPath

			c.header("Vary", "User-Agent")
			const ua = c.req.header("User-Agent") ?? "";
			if (/cardyb|bluesky|bsky/i.test(ua)) {
				publicLog("[social] bsky image request")
				return "/og-bsky.png";
			}
			if (/\btwitterbot\b/i.test(ua)) {
				publicLog("[social] twitter image request")
				return "/og-twitter.png";
			}
			publicLog("[social] OpenGraph image request")
			return requestPath
		},
	})
}

export function client(serverDir: string) {
	const clientDistDir = path.resolve(serverDir, "../client");

	let html = "";
	let lastGen = 0
	let timeout: NodeJS.Timeout
	let htmlPromise: Promise<string> | null
	const _getHtml = async () => {
		if (!html || Date.now() - lastGen > REGEN_DELAY) {
			lastGen = Date.now()
			html = await prerenderClientIndex(serverDir);
			if (timeout) clearTimeout(timeout)
			timeout = setTimeout(getHtml, REGEN_DELAY - 1000)
			timeout.unref()
		}
		return html;
	};
	const getHtml = () => {
		if (htmlPromise) return htmlPromise
		const promise = _getHtml()
		htmlPromise = promise
		promise.then(() => {
			if (htmlPromise === promise) htmlPromise = null
		})
		return htmlPromise
	}
	setImmediate(getHtml).unref()

	const app = new Hono();

	app.get("/", (c) => c.html(getHtml()))

	app.get("/og.png", ogImage(clientDistDir))

	app.use("*", serveStatic({ root: clientDistDir }));

	app.get("*", async (c) => {
		if (c.req.path.includes(".")) {
			return c.notFound();
		} else {
			return c.html(getHtml());
		}
	});

	return app;
}

export async function devClient(server: ServerType) {
	const { createServer } = await import("vite");

	const vite = await createServer({
		server: {
			middlewareMode: true,
			hmr: { server: server as HttpServer },
		},
	});

	return createMiddleware(async (c, next) => {
		if (c.req.path.startsWith("/api")) {
			await next();
			return;
		}

		try {
			await new Promise<void>((resolveMiddleware, rejectMiddleware) => {
				vite?.middlewares(
					c.env.incoming,
					c.env.outgoing,
					(error?: Error) => {
						if (error) {
							rejectMiddleware(error);
							return;
						}

						resolveMiddleware();
					},
				);
			});

			return RESPONSE_ALREADY_SENT;
		} catch (error) {
			const err = error as Error;
			vite?.ssrFixStacktrace(err);
			return c.text(err.stack ?? err.message, 500);
		}
	});
}
