import { fileURLToPath } from "node:url";
import { createAdaptorServer, type HttpBindings } from "@hono/node-server";
import { Hono } from "hono";
import { llms } from "./llms.ts";
import { client, devClient } from "./client.ts";
import { api } from "./api/index.ts";

export async function createWebServer(isDev: boolean) {
	const app = new Hono<{ Bindings: HttpBindings }>();
	const server = createAdaptorServer({ fetch: app.fetch });

	app.route("/", llms());
	app.route("/api", api());

	if (isDev) {
		app.use("*", await devClient(server));
	} else {
		const serverDir = fileURLToPath(new URL(".", import.meta.url));
		app.route("/", client(serverDir));
	}

	return server;
}
