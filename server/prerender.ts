import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as v from "valibot";

const nonEmptyString = v.pipe(v.string(), v.nonEmpty());

const prerenderManifestSchema = v.object({
	before: nonEmptyString,
	entry: nonEmptyString,
	destination: nonEmptyString,
	exportName: nonEmptyString,
	placeholder: nonEmptyString,
	template: nonEmptyString,
});

export async function prerenderClientIndex(serverDir: string) {
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

	const shell = await render();
	const result = manifest.template.replace(
		manifest.placeholder,
		manifest.before + "<body>" + shell + "</body>",
	);
	await fs.writeFile(destination, result);
	return result;
}
