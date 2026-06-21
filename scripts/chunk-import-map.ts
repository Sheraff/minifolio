import { type Plugin } from "vite";

const importMapScriptRE =
	/[ \t]*<script[^>]*type\s*=\s*(?:"importmap"|'importmap'|importmap)[^>]*>[\s\S]*?<\/script>/i;
const moduleStartRE =
	/[ \t]*(?:<script[^>]*type\s*=\s*(?:"module"|'module'|module)[^>]*>|<link[^>]*rel\s*=\s*(?:"modulepreload"|'modulepreload'|modulepreload)[^>]*>)/i;

export function chunkImportMap({
	environment = "client",
	fileName = "importmap.json",
}: {
	/** which environment should use chunk import maps */
	environment?: string;
	/** temporary emitted import map asset name */
	fileName?: string;
} = {}): Plugin {
	return {
		name: "chunk-import-map",
		apply: "build",
		enforce: "post",
		sharedDuringBuild: true,
		applyToEnvironment(env) {
			return env.name === environment;
		},
		config(config) {
			config.environments ??= {};
			config.environments[environment] ??= {};

			const target = config.environments[environment];
			target.consumer ??= "client";
			target.build ??= {};
			target.build.rolldownOptions ??= {};
			target.build.rolldownOptions.experimental ??= {};
			target.build.rolldownOptions.experimental.chunkImportMap = {
				baseUrl: config.base ?? "/",
				fileName,
			};
		},
		generateBundle(_, bundle) {
			const importMap = bundle[fileName];
			if (importMap?.type !== "asset") return;

			let injected = false;
			const source = toString(importMap.source);
			const script = `<script type="importmap">${source}</script>`;

			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== "asset" || !chunk.fileName.endsWith(".html")) {
					continue;
				}

				chunk.source = injectImportMap(toString(chunk.source), script);
				injected = true;
			}

			if (injected) {
				delete bundle[fileName];
			} else {
				this.warn(
					`Generated ${fileName}, but found no HTML asset to inject it into`,
				);
			}
		},
	};
}

function injectImportMap(html: string, script: string) {
	if (importMapScriptRE.test(html)) {
		return html.replace(importMapScriptRE, script);
	}

	const moduleStart = html.search(moduleStartRE);
	if (moduleStart >= 0) {
		return html.slice(0, moduleStart) + script + "\n" + html.slice(moduleStart);
	}

	const headEnd = html.search(/<\/head>/i);
	if (headEnd >= 0) {
		return html.slice(0, headEnd) + script + "\n" + html.slice(headEnd);
	}

	return script + "\n" + html;
}

function toString(source: string | Uint8Array) {
	return typeof source === "string" ? source : new TextDecoder().decode(source);
}
