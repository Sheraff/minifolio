import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";
import { prerenderClientIndex } from "./prerender.ts";
import { createMiddleware } from "hono/factory";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { publicLog } from "./public-logs.ts";
import type { ShutdownScope } from "./utils/shutdown.ts";
import type { Server } from "node:http";
import type { GitHubService } from "./github/types.ts";

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

export function client(
	serverDir: string,
	parentScope: ShutdownScope,
	github: GitHubService,
) {
	const clientDistDir = path.resolve(serverDir, "../client");

	let html = "";
	let lastGen = 0
	let timeout: NodeJS.Timeout
	let htmlPromise: Promise<string> | null
	const prerenderScope = parentScope.child("client prerender", {
		close: async () => {
			if (timeout) clearTimeout(timeout)
			try {
				await htmlPromise
			} finally {
				prerenderScope.done()
			}
		},
	})

	const REGEN_DELAY = 6 * 60 * 60 * 1000 // 6 hours
	const _getHtml = async () => {
		if (!html || Date.now() - lastGen > REGEN_DELAY) {
			lastGen = Date.now()
			html = await prerenderClientIndex(serverDir, github);
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
		const clearPromise = () => {
			if (htmlPromise === promise) htmlPromise = null
		}
		promise.then(clearPromise, clearPromise)
		return htmlPromise
	}
	setImmediate(getHtml).unref()

	const app = new Hono();

	app.get("/", (c) => c.html(getHtml()))

	app.get("/og.png", ogImage(clientDistDir))

	const clientStatic = serveStatic({ root: clientDistDir });
	
	const IMMUTABLE_ASSET_RE = /^\/assets\/.+\.(?:js|css)$/
	function cacheClientAsset(requestPath: string, response: Response | void) {
		if (IMMUTABLE_ASSET_RE.test(requestPath) && response?.headers) {
			response.headers.set("Cache-Control", "public, max-age=31536000, immutable")
		}
	}

	app.use("*", async (c, next) => {
		const response = await clientStatic(c, next)
		cacheClientAsset(c.req.path, response)
		return response
	});

	app.get("*", async (c) => {
		if (c.req.path.includes(".")) {
			return c.notFound();
		} else {
			return c.html(getHtml());
		}
	});

	return app;
}

export async function devClient(server: Server, parentScope: ShutdownScope) {
	const { createServer } = await import("vite");

	const vite = await createServer({
		server: {
			middlewareMode: true,
			hmr: { server },
		},
	});

	const viteScope = parentScope.child("vite server", {
		close: async () => {
			await vite.close()
			viteScope.done()
		},
	})

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
