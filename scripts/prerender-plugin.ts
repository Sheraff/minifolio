import path from "node:path";
import fs from "node:fs/promises";
import { type Plugin } from "vite";

const manifestFileName = "prerender-manifest.json";

type PrerenderManifest = {
	before: string;
	entry: string;
	destination: string;
	exportName: string;
	placeholder: string;
	template: string;
};

export function prerenderPlugin({
	server = "server",
	target = "client",
	entry = "src/prerender.tsx",
	entryName = "prerender",
	exportName = "renderShell",
	placeholder = "<body></body>",
	inject,
}: {
	/** Vite environment that builds the runtime prerender entry */
	server?: string;
	/** Vite environment whose index.html should be prerendered at runtime */
	target?: string;
	/** Path to the prerendering module */
	entry?: string;
	/** Name for the prerendering entry in the server build */
	entryName?: string;
	/** Name of the import to read from prerendering module `entry` */
	exportName?: string;
	/** Exact string in client index.html to replace with prerendered output */
	placeholder?: string;
	/** HTML to inject before the prerendered output, if provided must at least include generateHydrationScript() from solid-js/web */
	inject?: () => string;
} = {}): Plugin[] {
	let state = getInitialState();
	const entryFileName = `${entryName}.js`;

	async function maybeWriteManifest() {
		if (
			state.written ||
			!state.serverOutDir ||
			!state.destination ||
			!state.template
		) {
			return;
		}

		if (!state.template.includes(placeholder)) {
			throw new Error(`Unable to find ${placeholder} in ${state.destination}`);
		}

		const before = inject
			? inject()
			: await import("solid-js/web").then(
					({ generateHydrationScript }) => generateHydrationScript() + "\n",
				);

		const manifest: PrerenderManifest = {
			before,
			entry: `./${entryFileName}`,
			destination: toRelativePath(state.serverOutDir, state.destination),
			exportName,
			placeholder,
			template: state.template,
		};

		await fs.writeFile(
			path.join(state.serverOutDir, manifestFileName),
			JSON.stringify(manifest, null, 2),
		);
		state.written = true;
	}

	return [
		{
			name: "prerender-server-entry",
			apply: "build",
			sharedDuringBuild: true,
			applyToEnvironment(env) {
				return env.name === server;
			},
			config(config) {
				config.environments ??= {};
				config.environments[server] ??= {};

				const environment = config.environments[server];
				environment.consumer ??= "server";
				environment.build ??= {};

				const build = environment.build;
				build.rolldownOptions ??= {};

				const input = normalizeInput(build.rolldownOptions.input);
				if (typeof build.ssr === "string") {
					input.server ??= build.ssr;
				}

				input[entryName] = entry;
				build.ssr = true;
				build.rolldownOptions.input = input;

				const output = normalizeOutput(build.rolldownOptions.output);
				for (const item of output) {
					if (
						!item.entryFileNames ||
						(typeof item.entryFileNames === "string" &&
							!item.entryFileNames.includes("[name]"))
					) {
						item.entryFileNames = "[name].js";
					}
				}
				build.rolldownOptions.output = output.length === 1 ? output[0] : output;
			},
			async writeBundle(options) {
				if (!options.dir) {
					throw new Error(`No output directory found for ${server} environment`);
				}
				state.serverOutDir = path.resolve(options.dir);
				await maybeWriteManifest();
			},
		},
		{
			name: "prerender-manifest",
			apply: "build",
			enforce: "post",
			sharedDuringBuild: true,
			applyToEnvironment(env) {
				return env.name === target;
			},
			async writeBundle(options) {
				if (!options.dir) {
					throw new Error(`No output directory found for ${target} environment`);
				}

				state.destination = path.resolve(path.join(options.dir, "index.html"));
				state.template = await fs.readFile(state.destination, "utf8");
				await maybeWriteManifest();
			},
		},
	];
}

function getInitialState() {
	return {
		serverOutDir: "",
		destination: "",
		template: "",
		written: false,
	};
}

function normalizeInput(input: unknown): Record<string, string> {
	if (!input) return {};

	if (typeof input === "string") {
		return { server: input };
	}

	if (Array.isArray(input)) {
		return Object.fromEntries(
			input.map((item) => [path.basename(item, path.extname(item)), item]),
		);
	}

	if (typeof input === "object") {
		return { ...(input as Record<string, string>) };
	}

	throw new Error("Unsupported server build input for prerender plugin");
}

function normalizeOutput(output: unknown): Array<Record<string, unknown>> {
	if (!output) return [{}];
	if (Array.isArray(output)) {
		return output.map((item) => ({ ...(item as Record<string, unknown>) }));
	}
	return [{ ...(output as Record<string, unknown>) }];
}

function toRelativePath(from: string, to: string) {
	const relative = path.relative(from, to).split(path.sep).join(path.posix.sep);
	return relative.startsWith(".") ? relative : `./${relative}`;
}
