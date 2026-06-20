import path from "node:path";
import fs from "node:fs/promises";
import { type Plugin } from "vite";

export function inlineCss({
	environment = "client",
}: {
	/** which environment does this plugin apply to */
	environment?: string;
} = {}): Plugin {
	let base = "";
	return {
		name: "inline-css",
		apply: "build",
		applyToEnvironment(env) {
			return env.name === environment;
		},
		configResolved(config) {
			base = config.base ?? "/";
		},
		async writeBundle(options, bundle) {
			type AssetChunk = Extract<(typeof bundle)[string], { type: "asset" }>;
			const css = new Map<string, AssetChunk>();
			const html: AssetChunk[] = [];

			for (const key in bundle) {
				const chunk = bundle[key];
				if (chunk.type !== "asset") continue;
				if (chunk.fileName.endsWith(".css")) {
					css.set(path.join(base, chunk.fileName), chunk);
				} else if (chunk.fileName.endsWith(".html")) {
					html.push(chunk);
				}
			}

			for (const chunk of html) {
				const fileName = path.join(options.dir ?? "dist", chunk.fileName);
				let html = await fs.readFile(fileName, "utf8");

				const matches = html.matchAll(
					/<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g,
				);
				let some = false;
				for (const match of matches) {
					const href = match[1];
					const cssChunk = css.get(href);
					if (!cssChunk) continue;
					some = true;
					html = html.replace(
						`<link rel="stylesheet" crossorigin href="${href}">`,
						`<style>${cssChunk.source.toString()}</style>`,
					);
				}

				if (some) {
					await fs.writeFile(fileName, html);
				}
			}
		},
	};
}
