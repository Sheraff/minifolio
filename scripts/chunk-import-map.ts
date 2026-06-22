import path from "node:path";
import fs from "node:fs/promises";
import { type Plugin } from "vite";

type BundleAsset = {
	type: "asset";
	fileName: string;
	source: string | Uint8Array;
};

type BundleChunk = {
	type: "chunk";
	fileName: string;
	code: string;
	imports?: string[];
	viteMetadata?: {
		importedCss?: Set<string>;
	};
};

type BundleItem = BundleAsset | BundleChunk;
type Bundle = Record<string, BundleItem>;

const importMapScriptRE =
	/[ \t]*<script[^>]*type\s*=\s*(?:"importmap"|'importmap'|importmap)[^>]*>[\s\S]*?<\/script>/i;
const moduleStartRE =
	/[ \t]*(?:<script[^>]*type\s*=\s*(?:"module"|'module'|module)[^>]*>|<link[^>]*rel\s*=\s*(?:"modulepreload"|'modulepreload'|modulepreload)[^>]*>)/i;
const emptyPreloadDepsRE =
	/([$A-Z_a-z][$\w]*\(\s*\(\s*\)\s*=>\s*import\(\s*([`'"])([^`'"]+)\2\s*\)\s*,\s*)\[\s*\]\s*\)/g;
const cssMapScriptId = "chunk-import-map-css";
const cssMapScriptRE = new RegExp(
	`[ \\t]*<script[^>]*id\\s*=\\s*(?:"${cssMapScriptId}"|'${cssMapScriptId}'|${cssMapScriptId})[^>]*>[\\s\\S]*?<\\/script>`,
	"i",
);
const cssDepsHelper = `function __chunkImportMapCssDeps(specifier){let map=globalThis.__chunkImportMapCssDepsMap;if(!map){let el=document.getElementById("${cssMapScriptId}");map=globalThis.__chunkImportMapCssDepsMap=el?JSON.parse(el.textContent||"{}"):{};}return map[new URL(specifier,import.meta.url).pathname]||[]}\n`;
const absoluteUrlRE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

export function chunkImportMap({
	environment = "client",
	fileName = "importmap.json",
}: {
	/** which environment should use chunk import maps */
	environment?: string;
	/** temporary emitted import map asset name */
	fileName?: string;
} = {}): Plugin {
	let base = "/";
	let importMapSource = "";
	let importMapImports: Record<string, string> = {};

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
		configResolved(config) {
			base = config.base;
		},
		augmentChunkHash(chunk) {
			if (chunk.dynamicImports.length) {
				return "chunk-import-map-css-preload-v1";
			}
		},
		generateBundle(_, bundle) {
			const output = bundle as Bundle;
			const importMap = output[fileName];
			if (importMap?.type !== "asset") return;

			let injected = false;
			importMapSource = toString(importMap.source);
			importMapImports = readImportMap(importMapSource)?.imports ?? {};
			const mappedChunks = getMappedChunksByImportMapPath(
				importMapImports,
				output,
				base,
			);
			const cssDeps = new Map<string, string[]>();
			const patched = patchDynamicCssPreloads(
				output,
				mappedChunks,
				cssDeps,
				base,
			);
			const scripts = createImportMapScripts(
				importMapSource,
				patched > 0 ? cssDeps : undefined,
			);

			for (const chunk of Object.values(output)) {
				if (chunk.type !== "asset" || !chunk.fileName.endsWith(".html")) {
					continue;
				}

				chunk.source = injectImportMap(toString(chunk.source), scripts);
				injected = true;
			}

			if (injected) {
				delete output[fileName];
			} else {
				this.warn(
					`Generated ${fileName}, but found no HTML asset to inject it into`,
				);
			}
		},
		async writeBundle(options, bundle) {
			if (!importMapSource) return;

			const output = bundle as Bundle;
			const mappedChunks = getMappedChunksByImportMapPath(
				importMapImports,
				output,
				base,
			);
			if (!mappedChunks.size) return;

			const cssDeps = new Map<string, string[]>();

			const outDir = options.dir ?? path.dirname(options.file ?? "dist");
			const patched = await patchWrittenDynamicCssPreloads(
				outDir,
				output,
				mappedChunks,
				cssDeps,
				base,
			);

			if (patched > 0) {
				await writeCssMapToHtml(outDir, output, importMapSource, cssDeps);
			}
		},
	};
}

function readImportMap(source: string) {
	try {
		return JSON.parse(source) as { imports?: Record<string, string> };
	} catch {
		return null;
	}
}

function getMappedChunksByImportMapPath(
	imports: Record<string, string>,
	bundle: Bundle,
	base: string,
) {
	const mappedChunks = new Map<string, string>();

	for (const [placeholder, mapped] of Object.entries(imports)) {
		if (!placeholder.endsWith(".js") || !mapped.endsWith(".js")) continue;

		const fileName = toBundleFileName(mapped, base);
		const chunk = bundle[fileName];
		if (chunk?.type !== "chunk") continue;

		mappedChunks.set(toPathname(placeholder, base), fileName);
	}

	return mappedChunks;
}

function collectImportedCss(
	fileName: string,
	bundle: Bundle,
	owner: string,
	seen = new Set<string>(),
	css: string[] = [],
) {
	if (fileName === owner) return css;
	if (seen.has(fileName)) return css;
	seen.add(fileName);

	const chunk = bundle[fileName];
	if (chunk?.type !== "chunk") return css;

	for (const imported of chunk.imports ?? []) {
		collectImportedCss(imported, bundle, owner, seen, css);
	}

	for (const file of chunk.viteMetadata?.importedCss ?? []) {
		if (!css.includes(file)) css.push(file);
	}

	return css;
}

function patchDynamicCssPreloads(
	bundle: Bundle,
	mappedChunks: Map<string, string>,
	cssDeps: Map<string, string[]>,
	base: string,
) {
	let patched = 0;

	for (const chunk of Object.values(bundle)) {
		if (chunk.type !== "chunk") continue;

		const result = patchDynamicCssPreloadCode(
			chunk.code,
			chunk.fileName,
			bundle,
			mappedChunks,
			cssDeps,
			base,
		);

		if (result.changed) {
			chunk.code = result.code;
			patched++;
		}
	}

	return patched;
}

async function patchWrittenDynamicCssPreloads(
	outDir: string,
	bundle: Bundle,
	mappedChunks: Map<string, string>,
	cssDeps: Map<string, string[]>,
	base: string,
) {
	let patched = 0;

	for (const chunk of Object.values(bundle)) {
		if (chunk.type !== "chunk") continue;

		const fileName = path.join(outDir, chunk.fileName);
		const code = await fs.readFile(fileName, "utf8");
		const result = patchDynamicCssPreloadCode(
			code,
			chunk.fileName,
			bundle,
			mappedChunks,
			cssDeps,
			base,
		);

		if (result.changed) {
			await fs.writeFile(fileName, result.code);
			patched++;
		}
	}

	return patched;
}

function patchDynamicCssPreloadCode(
	code: string,
	fileName: string,
	bundle: Bundle,
	mappedChunks: Map<string, string>,
	cssDeps: Map<string, string[]>,
	base: string,
) {
	let changed = false;
	const next = code.replace(
		emptyPreloadDepsRE,
		(match, prefix: string, quote: string, specifier: string) => {
			const key = resolveImportPath(specifier, fileName, base);
			const mappedChunk = mappedChunks.get(key);
			if (!mappedChunk) return match;

			const css = collectImportedCss(mappedChunk, bundle, fileName);
			if (!css.length) return match;

			addCssDeps(cssDeps, key, css);
			changed = true;
			return `${prefix}__chunkImportMapCssDeps(${quote}${specifier}${quote}))`;
		},
	);

	return {
		changed,
		code: changed ? prependHelper(next) : code,
	};
}

function addCssDeps(
	cssDeps: Map<string, string[]>,
	key: string,
	files: string[],
) {
	const existing = cssDeps.get(key);
	if (!existing) {
		cssDeps.set(key, files);
		return;
	}

	for (const file of files) {
		if (!existing.includes(file)) existing.push(file);
	}
}

async function writeCssMapToHtml(
	outDir: string,
	bundle: Bundle,
	importMapSource: string,
	cssDeps: Map<string, string[]>,
) {
	const scripts = createImportMapScripts(importMapSource, cssDeps);

	for (const chunk of Object.values(bundle)) {
		if (chunk.type !== "asset" || !chunk.fileName.endsWith(".html")) continue;

		const fileName = path.join(outDir, chunk.fileName);
		const html = await fs.readFile(fileName, "utf8");
		const next = injectImportMap(html, scripts);
		if (next !== html) await fs.writeFile(fileName, next);
	}
}

function createImportMapScripts(
	importMapSource: string,
	cssDeps?: Map<string, string[]>,
) {
	return [
		`<script type="importmap">${importMapSource}</script>`,
		cssDeps?.size
			? `<script type="application/json" id="${cssMapScriptId}">${escapeScriptJson(JSON.stringify(Object.fromEntries(cssDeps)))}</script>`
			: "",
	]
		.filter(Boolean)
		.join("\n");
}

function prependHelper(code: string) {
	if (!code.startsWith("#!")) return cssDepsHelper + code;

	const lineEnd = code.indexOf("\n");
	return lineEnd === -1
		? code + "\n" + cssDepsHelper
		: code.slice(0, lineEnd + 1) + cssDepsHelper + code.slice(lineEnd + 1);
}

function injectImportMap(html: string, script: string) {
	html = html.replace(cssMapScriptRE, "");

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

function escapeScriptJson(json: string) {
	return json.replace(/</g, "\\u003c");
}

function resolveImportPath(specifier: string, importer: string, base: string) {
	if (absoluteUrlRE.test(specifier)) return new URL(specifier).pathname;
	if (specifier.startsWith("/")) return specifier;

	return normalizePathname(
		pathJoin(getBasePath(base), path.posix.dirname(importer), specifier),
	);
}

function toPathname(url: string, base: string) {
	if (absoluteUrlRE.test(url)) return new URL(url).pathname;
	if (url.startsWith("/")) return url;

	return normalizePathname(pathJoin(getBasePath(base), url));
}

function toBundleFileName(url: string, base: string) {
	const basePath = getBasePath(base);
	const pathname = toPathname(url, base);

	if (basePath !== "/" && pathname.startsWith(basePath)) {
		return pathname.slice(basePath.length);
	}

	return pathname.startsWith("/") ? pathname.slice(1) : pathname;
}

function getBasePath(base: string) {
	let basePath = base || "/";
	if (absoluteUrlRE.test(basePath)) basePath = new URL(basePath).pathname;
	if (!basePath.startsWith("/")) basePath = "/" + basePath;
	return basePath.endsWith("/") ? basePath : basePath + "/";
}

function pathJoin(...segments: string[]) {
	return path.posix.join(...segments);
}

function normalizePathname(pathname: string) {
	return pathname.startsWith("/") ? pathname : "/" + pathname;
}
