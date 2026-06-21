import { createAdaptorServer, type HttpBindings } from "@hono/node-server";
import { Hono } from "hono";
import { llms } from "./llms.ts";
import { client, devClient } from "./client.ts";
import { api } from "./api/index.ts";
import { teapot } from "./teapot.ts";

export async function createWebServer(isDev: boolean, serverDir: string) {
	const app = new Hono<{ Bindings: HttpBindings }>();
	const server = createAdaptorServer({ fetch: app.fetch });

	app.route("/", llms());
	app.route("/api/brew", teapot());
	app.route("/api", api());

	if (isDev) {
		app.use("*", await devClient(server));
	} else {
		app.route("/", client(serverDir));
	}

	return server;
}
