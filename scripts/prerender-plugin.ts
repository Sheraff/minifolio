import path from "node:path";
import fs from "node:fs/promises";
import { type Plugin } from "vite";

const entryFileName = "prerender.js";

export function prerenderPlugin({
	environment = "prerender",
	target = "client",
	outDir = "dist/prerender",
	entry = "src/prerender.tsx",
	exportName = "renderShell",
	placeholder = "<body></body>",
	inject,
}: {
	/** Vite environment to use for prerendering */
	environment?: string;
	/** Vite environment to inject prerender into */
	target?: string;
	/** Where to write the prerendering bundle */
	outDir?: string;
	/** Path to the prerendering module */
	entry?: string;
	/** Name of the import to read from prerendering module `entry` */
	exportName?: string;
	/** Exact string in client index.html to replace with prerendered output */
	placeholder?: string;
	/** HTML to inject before the prerendered output, if provided must at least include generateHydrationScript() from solid/web */
	inject?: () => string;
} = {}): Plugin[] {
	let state = getInitialState();
	return [
		{
			name: "prerender-client",
			apply: "build",
			enforce: "post",
			sharedDuringBuild: true,
			applyToEnvironment(env) {
				return env.name === target;
			},
			async writeBundle(options) {
				if (!options.dir)
					throw new Error(
						`No output directory found for ${target} environment`,
					);
				state.destination = path.resolve(
					path.join(options.dir, "index.html"),
				);
				if (!state.source) return;
				await prerender({
					destination: state.destination,
					exportName,
					placeholder,
					source: state.source,
					inject,
				});
				state = getInitialState();
			},
		},
		{
			name: "prerender-server",
			apply: "build",
			enforce: "post",
			sharedDuringBuild: true,
			applyToEnvironment(env) {
				return env.name === environment;
			},
			async config(config) {
				config.environments ??= {};
				config.environments[environment] = {
					consumer: "server",
					build: {
						ssr: entry,
						outDir,
						copyPublicDir: false,
						emptyOutDir: true,
						emitAssets: false,
						target: "node24",
						rolldownOptions: {
							output: {
								entryFileNames: entryFileName,
							},
						},
					},
				};
			},
			async writeBundle(options) {
				if (!options.dir) {
					throw new Error(
						`No output directory found for ${environment} environment`,
					);
				}
				state.source = path.resolve(path.join(options.dir, entryFileName));
				if (!state.destination) return;
				await prerender({
					destination: state.destination,
					exportName,
					placeholder,
					source: state.source,
					inject,
				});
				state = getInitialState();
			},
		},
	];
}

function getInitialState() {
	return {
		source: "",
		destination: "",
	};
}

// type RenderStream = {
// 	pipe: (writable: { write: (v: string) => void }) => void;
// 	pipeTo: (writable: WritableStream<any>) => void;
// };

// type RenderStringAsync = Promise<string>

// type RenderString = string

async function prerender(options: {
	source: string;
	destination: string;
	exportName: string;
	placeholder: string;
	inject?: () => string;
}) {
	const { [options.exportName]: render } = await import(options.source);
	const shell = await render();

	const indexPath = path.resolve(options.destination);
	const html = await fs.readFile(indexPath, "utf8");

	if (!html.includes(options.placeholder))
		throw new Error(`Unable to find ${options.placeholder} in ${indexPath}`);

	let before;
	if (options.inject) {
		before = options.inject();
	} else {
		const { generateHydrationScript } = await import("solid-js/web");
		before = generateHydrationScript() + "\n";
	}

	await fs.writeFile(
		indexPath,
		html.replace(options.placeholder, before + "<body>" + shell + "</body>"),
	);

	await fs.writeFile(
		path.join(path.dirname(options.source), "prerender-manifest.json"),
		JSON.stringify(
			{
				before,
				source: options.source,
				destination: options.destination,
				exportName: options.exportName,
				placeholder: options.placeholder,
			},
			null,
			2,
		),
	);
}
