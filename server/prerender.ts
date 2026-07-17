import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as v from "valibot";
import { publicLog } from "./public-logs.ts";
import { fetchTanstackArticles } from "./api/articles.ts";
import { fetchLabProjects } from "./api/projects.ts";
import type { GitHubService } from "./github/types.ts";

const DATA_TIMEOUT_MS = 60_000;

const nonEmptyString = v.pipe(v.string(), v.nonEmpty());

const prerenderManifestSchema = v.object({
	before: nonEmptyString,
	entry: nonEmptyString,
	destination: nonEmptyString,
	exportName: nonEmptyString,
	placeholder: nonEmptyString,
	template: nonEmptyString,
});

export async function prerenderClientIndex(serverDir: string, github: GitHubService) {
	const manifestPath = path.resolve(serverDir, "prerender-manifest.json");
	const manifest = v.parse(
		prerenderManifestSchema,
		JSON.parse(await fs.readFile(manifestPath, "utf8")),
	);
	const manifestDir = path.dirname(manifestPath);
	const entryPath = path.resolve(manifestDir, manifest.entry);
	const destination = path.resolve(manifestDir, manifest.destination);
	const renderModule = await import(pathToFileURL(entryPath).href);
	const render = renderModule[manifest.exportName];

	if (typeof render !== "function") {
		throw new Error(
			`Unable to find ${manifest.exportName} export in ${entryPath}`,
		);
	}

	if (!manifest.template.includes(manifest.placeholder)) {
		throw new Error(
			`Unable to find ${manifest.placeholder} in prerender template`,
		);
	}

	publicLog("[ssr] prerendering html");
	const data = Promise.all([
		github.getContributions(),
		github.getRepositories(),
		fetchTanstackArticles(),
		fetchLabProjects(),
	]);
	let timeout: NodeJS.Timeout | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => reject(new Error("Prerender data loading timed out")), DATA_TIMEOUT_MS);
		timeout.unref();
	});
	const [contributions, repositories, articles, projects] = await Promise.race([
		data,
		timeoutPromise,
	]).finally(() => {
		if (timeout) clearTimeout(timeout);
	});
	const shell = await render({
		"/api/github/contributions": contributions,
		"/api/github/repositories": repositories,
		"/api/articles/tanstack": articles,
		"/api/projects": projects,
	});
	const result = manifest.template.replace(
		manifest.placeholder,
		manifest.before + "<body>" + shell + "</body>",
	);
	await fs.writeFile(destination, result);
	return result;
}
