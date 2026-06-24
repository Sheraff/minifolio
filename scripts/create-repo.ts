import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type RepoAuthor = {
	name: string;
	email: string;
};

type RepoCommit = {
	oid: string;
	shortOid: string;
	parents: string[];
	author: RepoAuthor & { date: string };
	message: string;
};

type RepoRef = {
	type: "branch" | "tag";
	name: string;
	fullName: string;
	oid: string;
};

type RepoGraph = {
	defaultBranch: string;
	commits: RepoCommit[];
	refs: RepoRef[];
};

type BranchOptions = {
	from?: string;
	checkout?: boolean;
};

type FinalizedRepo = {
	bareDir: string;
	graphFile: string;
	graph: RepoGraph;
};

export function createRepo({
	dir,
	name,
	defaultBranch = "main",
	author,
}: {
	dir: string;
	name: string;
	defaultBranch?: string;
	author: RepoAuthor;
}) {
	assertSafeName(name);

	const outputDir = path.resolve(
		fileURLToPath(new URL("..", import.meta.url)),
		dir,
	);
	const workRoot = path.join(outputDir, ".work");
	const workDir = path.join(workRoot, name);
	const bareDir = path.join(outputDir, `${name}.git`);
	const graphFile = path.join(outputDir, `${name}.graph.json`);
	let ready: Promise<void> | undefined;
	let graph: RepoGraph = { defaultBranch, commits: [], refs: [] };
	let finalization: FinalizedRepo | undefined;

	const authorEnv: NodeJS.ProcessEnv = {
		GIT_AUTHOR_NAME: author.name,
		GIT_AUTHOR_EMAIL: author.email,
		GIT_COMMITTER_NAME: author.name,
		GIT_COMMITTER_EMAIL: author.email,
	};

	async function git(
		args: string[],
		{
			cwd = workDir,
			env,
		}: {
			cwd?: string;
			env?: NodeJS.ProcessEnv;
		} = {},
	) {
		return new Promise<string>((resolve, reject) => {
			execFile(
				"git",
				args,
				{
					cwd,
					env: { ...process.env, ...env },
					maxBuffer: 1024 * 1024,
				},
				(error, stdout, stderr) => {
					if (error) {
						reject(new Error(`${error.message}\n${stderr}`));
						return;
					}

					resolve(stdout.trimEnd());
				},
			);
		});
	}

	async function initialize() {
		await fs.mkdir(outputDir, { recursive: true });
		await fs.rm(workDir, { recursive: true, force: true });
		await fs.rm(bareDir, { recursive: true, force: true });
		await fs.rm(graphFile, { force: true });
		await fs.mkdir(path.dirname(workDir), { recursive: true });

		await git(["init", `--initial-branch=${defaultBranch}`, workDir], {
			cwd: outputDir,
		});
		await git(["config", "user.name", author.name]);
		await git(["config", "user.email", author.email]);
		await git(["config", "commit.gpgsign", "false"]);
	}

	function ensureReady() {
		if (finalization) {
			throw new Error(`Repository ${name} has already been finalized`);
		}

		ready ??= initialize();
		return ready;
	}

	async function refreshGraph() {
		const oids = splitLines(
			await git(["rev-list", "--topo-order", "--reverse", "--all"]),
		);
		const commits: RepoCommit[] = [];

		for (const oid of oids) {
			commits.push(await readCommit(oid));
		}

		graph = {
			defaultBranch,
			commits,
			refs: await readRefs(),
		};

		return graph;
	}

	async function readCommit(oid: string): Promise<RepoCommit> {
		const stdout = await git([
			"show",
			"--no-patch",
			"--format=%H%x00%h%x00%P%x00%an%x00%ae%x00%aI%x00%B",
			oid,
		]);
		const [
			fullOid = oid,
			shortOid = oid.slice(0, 7),
			parents = "",
			name = "",
			email = "",
			date = "",
			...message
		] = stdout.split("\0");

		return {
			oid: fullOid,
			shortOid,
			parents: parents ? parents.split(" ") : [],
			author: { name, email, date },
			message: message.join("\0").trimEnd(),
		};
	}

	async function readRefs(): Promise<RepoRef[]> {
		const stdout = await git([
			"for-each-ref",
			"--format=%(refname)%00%(objectname)%00%(*objectname)",
			"refs/heads",
			"refs/tags",
		]);

		return splitLines(stdout).flatMap((line) => {
			const [fullName = "", oid = "", peeledOid = ""] = line.split("\0");
			const type = fullName.startsWith("refs/heads/") ? "branch" : "tag";
			const prefix = type === "branch" ? "refs/heads/" : "refs/tags/";

			if (!fullName.startsWith(prefix)) return [];

			return [
				{
					type,
					name: fullName.slice(prefix.length),
					fullName,
					oid: peeledOid || oid,
				},
			];
		});
	}

	async function writeFiles(files: Record<string, string | Uint8Array>) {
		for (const [file, contents] of Object.entries(files)) {
			const target = resolveRepoFile(workDir, file);
			await fs.mkdir(path.dirname(target), { recursive: true });
			await fs.writeFile(target, contents);
		}
	}

	async function currentCommit() {
		const oid = await git(["rev-parse", "HEAD"]);
		const nextGraph = await refreshGraph();
		const commit = nextGraph.commits.find((item) => item.oid === oid);

		if (!commit) {
			throw new Error(`Unable to read commit ${oid}`);
		}

		return commit;
	}

	return {
		async commit(options: {
			message: string;
			files?: Record<string, string | Uint8Array>;
			date?: string | Date;
		}) {
			await ensureReady();

			if (options.files) {
				await writeFiles(options.files);
			}

			await git(["add", "--all"]);
			await git(["commit", "--message", options.message, "--allow-empty"], {
				env: { ...authorEnv, ...dateEnv(options.date) },
			});

			return currentCommit();
		},

		async branch(name: string, options: BranchOptions = {}) {
			await ensureReady();
			await git(["branch", name, ...(options.from ? [options.from] : [])]);

			if (options.checkout) {
				await git(["switch", name]);
			}

			await refreshGraph();
		},

		async switchBranch(
			name: string,
			options: {
				create?: boolean;
				from?: string;
			} = {},
		) {
			await ensureReady();

			if (options.from && !options.create) {
				throw new Error("switchBranch from option requires create: true");
			}

			await git([
				"switch",
				...(options.create ? ["--create"] : []),
				name,
				...(options.from ? [options.from] : []),
			]);
			await refreshGraph();
		},

		async tag(
			name: string,
			options: {
				ref?: string;
				force?: boolean;
			} = {},
		) {
			await ensureReady();
			await git([
				"tag",
				...(options.force ? ["--force"] : []),
				name,
				...(options.ref ? [options.ref] : []),
			]);
			await refreshGraph();
		},

		async merge(
			ref: string,
			options: {
				message?: string;
				date?: string | Date;
			} = {},
		) {
			await ensureReady();
			await git(
				[
					"merge",
					"--no-ff",
					...(options.message
						? ["--message", options.message]
						: ["--no-edit"]),
					ref,
				],
				{ env: { ...authorEnv, ...dateEnv(options.date) } },
			);

			return currentCommit();
		},

		async finalize(): Promise<FinalizedRepo> {
			if (finalization) return finalization;

			await ensureReady();
			await refreshGraph();
			await fs.rm(bareDir, { recursive: true, force: true });
			await git(["clone", "--bare", workDir, bareDir], { cwd: outputDir });
			await git(["remote", "remove", "origin"], { cwd: bareDir });
			await git(["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`], {
				cwd: bareDir,
			});
			await fs.writeFile(graphFile, `${JSON.stringify(graph, null, 2)}\n`);
			await fs.rm(workRoot, { recursive: true, force: true });

			finalization = { bareDir, graphFile, graph };
			return finalization;
		},
	};
}

function dateEnv(date?: string | Date): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	if (date) {
		const value = date instanceof Date ? date.toISOString() : date;
		env.GIT_AUTHOR_DATE = value;
		env.GIT_COMMITTER_DATE = value;
	}

	return env;
}

function assertSafeName(name: string) {
	if (!/^[a-zA-Z0-9._-]+$/.test(name) || name === "." || name === "..") {
		throw new Error(`Unsafe repository name: ${name}`);
	}
}

function resolveRepoFile(root: string, file: string) {
	if (file.includes("\0") || path.isAbsolute(file)) {
		throw new Error(`Unsafe repository file path: ${file}`);
	}

	const target = path.resolve(root, file);
	const relative = path.relative(root, target);

	if (
		!relative ||
		relative === ".." ||
		relative.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relative) ||
		relative.split(path.sep).includes(".git")
	) {
		throw new Error(`Unsafe repository file path: ${file}`);
	}

	return target;
}

function splitLines(value: string) {
	return value.split("\n").filter(Boolean);
}
