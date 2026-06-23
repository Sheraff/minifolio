import { createAdaptorServer, type HttpBindings } from "@hono/node-server";
import { Hono } from "hono";
import { llms } from "./llms.ts";
import { client, devClient } from "./client.ts";
import { api } from "./api/index.ts";
import { teapot } from "./teapot.ts";
import { publicLogBroadcast } from "./public-logs.ts";
import type { ShutdownScope } from "./utils/shutdown.ts";
import type { Server } from "node:http";

export async function createWebServer(
	isDev: boolean,
	serverDir: string,
	parentScope: ShutdownScope,
) {
	const app = new Hono<{ Bindings: HttpBindings }>();

	app.use("*", async (c, next) => {
		c.header("X-Clacks-Overhead", "GNU Terry Pratchett");
		await next();
	});

	if (!isDev) {
		app.use("*", async (c, next) => {
			c.header("X-Content-Type-Options", "nosniff");
			c.header("Referrer-Policy", "strict-origin-when-cross-origin");
			c.header(
				"Permissions-Policy",
				"camera=(), microphone=(), geolocation=(), payment=()",
			);
			c.header(
				"Content-Security-Policy",
				[
					"default-src 'self'",
					"base-uri 'self'",
					"object-src 'none'",
					"frame-ancestors 'none'",
					"form-action 'self'",
					"img-src 'self' https:",
					"font-src 'self'",
					"connect-src 'self'",
					"script-src 'self' 'unsafe-inline'",
					"script-src-attr 'none'",
					"style-src 'self' 'unsafe-inline'",
				].join("; "),
			);

			await next();
		});
	}

	// `server` type depends on whether you pass in `createServer` from 'node:http2'
	const server = createAdaptorServer({ fetch: app.fetch }) as Server;
	const scope = parentScope.child("http server", {
		close: (ctx) => {
			server.close();
			server.closeIdleConnections();
			void ctx.childrenClosed.finally(() => server.closeIdleConnections());
		},
		force: () => server.closeAllConnections(),
	});
	server.once("close", () => scope.done());

	app.route("/", llms());
	app.route("/api/brew", teapot());
	app.route("/api", api());
	app.route("/events", publicLogBroadcast(scope));

	if (isDev) {
		app.use("*", await devClient(server, scope));
	} else {
		app.route("/", client(serverDir, scope));
	}

	return server;
}
