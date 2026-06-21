import { Context, Hono } from "hono";
import { fetchTanstackArticles } from "./articles.ts";
import { fetchGitHubContributions } from "./github.ts";
import { fetchContributedRepositories } from "./githubRepositories.ts";
import { fetchLabProjects } from "./projects.ts";
import { teapot } from "../teapot.ts";

async function respond(
	c: Context,
	fetcher: () => Promise<unknown>,
	errorMessage: string,
) {
	if (c.req.method === "HEAD") {
		c.header("Cache-Control", "public, max-age=3600");
		return new Response(null, c.res);
	}
	try {
		const data = await fetcher();
		c.header("Cache-Control", "public, max-age=3600");
		return c.json(data);
	} catch (error) {
		console.error(error);
		c.header("Cache-Control", "no-store");
		return c.json({ error: errorMessage }, 502);
	}
}

export function api() {
	const app = new Hono();

	app.get("/health", (c) => c.json({ ok: true }));

	app.get("/projects", async (c) =>
		respond(c, fetchLabProjects, "Unable to load projects"),
	);
	app.get("/github/contributions", async (c) =>
		respond(
			c,
			fetchGitHubContributions,
			"Unable to load GitHub contributions",
		),
	);
	app.get("/github/repositories", async (c) =>
		respond(
			c,
			fetchContributedRepositories,
			"Unable to load contributed GitHub repositories",
		),
	);
	app.get("/articles/tanstack", async (c) =>
		respond(c, fetchTanstackArticles, "Unable to load TanStack articles"),
	);

	app.route("/brew", teapot());

	app.get("*", (c) => c.notFound());

	return app;
}
