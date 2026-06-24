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

type RawRepoGraph = {
	defaultBranch: string;
	commits: RepoCommit[];
	refs: RepoRef[];
};

type RenderRef = {
	type: RepoRef["type"];
	name: string;
};

type RenderCommit = {
	oid: string;
	row: number;
	lane: number;
	isMain: boolean;
	refs: RenderRef[];
	author: RepoAuthor;
	date: string;
	message: string;
};

type RenderEdge = {
	fromLane: number;
	toLane: number;
	fromRow: number;
	toRow: number;
	type: "branch" | "fork" | "merge";
	isMain: boolean;
};

type RenderLabel = {
	row: number;
	refs: RenderRef[];
};

type RepoGraph = {
	defaultBranch: string;
	lanes: number;
	rows: number;
	commits: RenderCommit[];
	edges: RenderEdge[];
	labels: RenderLabel[];
};

type LayoutCommit = {
	commit: RepoCommit;
	row: number;
	lane: number;
	isMain: boolean;
	segmentId?: number;
	refs: RenderRef[];
};

type SideSegment = {
	id: number;
	oids: string[];
	minRow: number;
	maxRow: number;
};

type PackedSideSegment = SideSegment & {
	lane: number;
};

type BranchOptions = {
	from?: string;
	checkout?: boolean;
};

export function createRepo({
	dest,
	json,
	name,
	defaultBranch = "main",
	author,
}: {
	dest: string;
	json?: string;
	name: string;
	defaultBranch?: string;
	author: RepoAuthor;
}) {
	assertSafeName(name);
	const rootDir = fileURLToPath(new URL("..", import.meta.url));

	const outputDir = path.join(rootDir, dest);
	const workRoot = path.join(outputDir, ".work");
	const workDir = path.join(workRoot, name);
	const bareDir = path.join(outputDir, `${name}.git`);
	const graphFile = path.join(outputDir, `${name}.graph.json`);
	const jsonDir = json && path.join(rootDir, json);
	const jsonFile = jsonDir && path.join(jsonDir, `${name}.graph.json`);
	let ready: Promise<void> | undefined;
	let rawGraph: RawRepoGraph = { defaultBranch, commits: [], refs: [] };
	let finalized = false;

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
		if (finalized) {
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

		rawGraph = {
			defaultBranch,
			commits,
			refs: await readRefs(),
		};

		return rawGraph;
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
		/**
		 * Writes the provided files, stages the whole worktree, and creates a commit.
		 * The returned commit is read back from Git, so its oid and parents match the
		 * actual repository state.
		 */
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

		/**
		 * Creates a branch ref, optionally from a specific revision, and optionally
		 * checks it out. When `from` is omitted, Git uses the current `HEAD`.
		 */
		async branch(name: string, options: BranchOptions = {}) {
			await ensureReady();
			await git(["branch", name, ...(options.from ? [options.from] : [])]);

			if (options.checkout) {
				await git(["switch", name]);
			}

			await refreshGraph();
		},

		/**
		 * Switches to an existing branch, or creates and switches to it when `create`
		 * is true. `from` can only be used with `create` and becomes the new branch's
		 * start point.
		 */
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

		/**
		 * Creates a lightweight tag. By default the tag points at `HEAD`; pass `ref`
		 * to tag another revision, or `force` to move an existing tag.
		 */
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

		/**
		 * Merges another ref into the current branch using `--no-ff`, creating an
		 * explicit merge commit for the portfolio graph. Returns the resulting commit
		 * as read back from Git.
		 */
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

		/**
		 * Finalizes the generated repository: refreshes the graph projection, creates
		 * the bare clone used by the Git server, writes the optional frontend JSON,
		 * and removes the temporary working repository. Subsequent calls are no-ops.
		 */
		async finalize(): Promise<void> {
			if (finalized) return;

			await ensureReady();
			await refreshGraph();
			await fs.rm(bareDir, { recursive: true, force: true });
			await git(["clone", "--bare", workDir, bareDir], { cwd: outputDir });
			await git(["remote", "remove", "origin"], { cwd: bareDir });
			await git(["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`], {
				cwd: bareDir,
			});
			await fs.rm(workRoot, { recursive: true, force: true });

			if (jsonDir && jsonFile) {
				const graph = createGraphProjection(rawGraph);
				fs.mkdir(jsonDir, { recursive: true });
				await fs.writeFile(jsonFile, JSON.stringify(graph, null, 2) + "\n");
			}

			finalized = true;
		},
	};
}

function createGraphProjection(data: RawRepoGraph): RepoGraph {
	const orderedCommits = [...data.commits].reverse();
	const commitByOid = new Map(
		data.commits.map((commit) => [commit.oid, commit]),
	);
	const refsByOid = groupRefsByOid(data.refs);
	const mainRef = findMainRef(data.refs, data.defaultBranch);
	const mainPath = traceFirstParentPath(mainRef?.oid, commitByOid);
	const rowByOid = new Map(
		orderedCommits.map((commit, index) => [commit.oid, index + 1]),
	);
	const sideSegments = packSideSegments(
		createSideSegments(
			orderedCommits,
			mainPath,
			commitByOid,
			rowByOid,
		),
	);
	const laneCount = Math.max(
		1,
		...sideSegments.map((segment) => segment.lane),
	);
	const laneByOid = new Map<string, number>();
	const segmentByOid = new Map<string, number>();

	for (const oid of mainPath) laneByOid.set(oid, 1);
	for (const segment of sideSegments) {
		for (const oid of segment.oids) {
			laneByOid.set(oid, segment.lane);
			segmentByOid.set(oid, segment.id);
		}
	}

	const layoutCommits = orderedCommits.map((commit): LayoutCommit => {
		const row = rowByOid.get(commit.oid) ?? 1;
		const lane = laneByOid.get(commit.oid) ?? 1;
		return {
			commit,
			row,
			lane,
			isMain: mainPath.has(commit.oid),
			segmentId: segmentByOid.get(commit.oid),
			refs: refsByOid.get(commit.oid) ?? [],
		};
	});

	const layoutByOid = new Map(
		layoutCommits.map((commit) => [commit.commit.oid, commit]),
	);

	return {
		defaultBranch: data.defaultBranch,
		lanes: Math.max(laneCount, 1),
		rows: layoutCommits.length,
		commits: layoutCommits.map((item) => ({
			oid: item.commit.oid,
			row: item.row,
			lane: item.lane,
			isMain: item.isMain,
			refs: item.refs,
			author: {
				name: item.commit.author.name,
				email: item.commit.author.email,
			},
			date: item.commit.author.date,
			message: item.commit.message,
		})),
		edges: createEdges(layoutCommits, layoutByOid),
		labels: createLabels(layoutCommits),
	};
}

function groupRefsByOid(refs: RepoRef[]) {
	const map = new Map<string, RenderRef[]>();
	for (const ref of [...refs].sort(compareRefs)) {
		const group = map.get(ref.oid) ?? [];
		group.push({ type: ref.type, name: ref.name });
		map.set(ref.oid, group);
	}
	return map;
}

function findMainRef(refs: RepoRef[], defaultBranch: string) {
	return (
		refs.find((ref) => ref.type === "branch" && ref.name === defaultBranch) ??
		refs.find((ref) => ref.type === "branch" && ref.name === "main") ??
		refs.find((ref) => ref.type === "branch")
	);
}

function createSideSegments(
	commits: RepoCommit[],
	mainPath: Set<string>,
	commitByOid: Map<string, RepoCommit>,
	rowByOid: Map<string, number>,
) {
	const assigned = new Set(mainPath);
	const segments: SideSegment[] = [];
	let nextId = 1;

	for (const commit of commits) {
		if (assigned.has(commit.oid)) continue;

		const oids = traceSideSegment(commit.oid, assigned, commitByOid);
		if (oids.length === 0) continue;

		segments.push({
			id: nextId++,
			oids,
			...createSegmentInterval(oids, commits, commitByOid, rowByOid),
		});

		for (const oid of oids) assigned.add(oid);
	}

	return segments;
}

function createSegmentInterval(
	oids: string[],
	commits: RepoCommit[],
	commitByOid: Map<string, RepoCommit>,
	rowByOid: Map<string, number>,
) {
	const segmentOids = new Set(oids);
	const rows = new Set<number>();
	const addRow = (oid: string | undefined) => {
		if (!oid) return;
		const row = rowByOid.get(oid);
		if (row !== undefined) rows.add(row);
	};

	for (const oid of oids) {
		addRow(oid);

		const commit = commitByOid.get(oid);
		if (!commit) continue;

		for (const parentOid of commit.parents) {
			if (!segmentOids.has(parentOid)) addRow(parentOid);
		}
	}

	for (const commit of commits) {
		if (segmentOids.has(commit.oid)) continue;
		if (commit.parents.some((parentOid) => segmentOids.has(parentOid))) {
			addRow(commit.oid);
		}
	}

	return {
		minRow: Math.min(...rows),
		maxRow: Math.max(...rows),
	};
}

function packSideSegments(segments: SideSegment[]): PackedSideSegment[] {
	const laneMaxRows: number[] = [];

	return [...segments].sort(compareSideSegments).map((segment) => {
		const laneIndex = laneMaxRows.findIndex(
			(maxRow) => maxRow <= segment.minRow,
		);
		const lane = laneIndex === -1 ? laneMaxRows.length + 2 : laneIndex + 2;

		if (laneIndex === -1) {
			laneMaxRows.push(segment.maxRow);
		} else {
			laneMaxRows[laneIndex] = segment.maxRow;
		}

		return { ...segment, lane };
	});
}

function compareSideSegments(a: SideSegment, b: SideSegment) {
	return a.minRow - b.minRow || a.maxRow - b.maxRow || a.id - b.id;
}

function traceFirstParentPath(
	startOid: string | undefined,
	commitByOid: Map<string, RepoCommit>,
) {
	const path = new Set<string>();
	let oid = startOid;

	while (oid && !path.has(oid)) {
		const commit = commitByOid.get(oid);
		if (!commit) break;
		path.add(oid);
		oid = commit.parents[0];
	}

	return path;
}

function traceSideSegment(
	startOid: string,
	assigned: Set<string>,
	commitByOid: Map<string, RepoCommit>,
) {
	const path: string[] = [];
	const seen = new Set<string>();
	let oid: string | undefined = startOid;

	while (oid && !seen.has(oid) && !assigned.has(oid)) {
		const commit = commitByOid.get(oid);
		if (!commit) break;
		seen.add(oid);
		path.push(oid);
		oid = commit.parents[0];
	}

	return path;
}

function createEdges(
	commits: LayoutCommit[],
	layoutByOid: Map<string, LayoutCommit>,
) {
	const edges: RenderEdge[] = [];
	const commitsByBranch = new Map<string, LayoutCommit[]>();

	for (const item of commits) {
		const branchKey = createBranchGroupKey(item);
		const branchCommits = commitsByBranch.get(branchKey) ?? [];
		branchCommits.push(item);
		commitsByBranch.set(branchKey, branchCommits);
	}

	for (const branchCommits of commitsByBranch.values()) {
		if (branchCommits.length < 2) continue;

		const rows = branchCommits.map((item) => item.row);
		const lane = branchCommits[0].lane;
		edges.push({
			fromLane: lane,
			toLane: lane,
			fromRow: Math.min(...rows),
			toRow: Math.max(...rows),
			type: "branch",
			isMain: branchCommits.every((item) => item.isMain),
		});
	}

	for (const item of commits) {
		item.commit.parents.forEach((parentOid, index) => {
			const parent = layoutByOid.get(parentOid);
			if (!parent) return;
			if (
				item.lane === parent.lane &&
				createBranchGroupKey(item) === createBranchGroupKey(parent)
			) {
				return;
			}

			edges.push({
				fromLane: item.lane,
				toLane: parent.lane,
				fromRow: item.row,
				toRow: parent.row,
				type: createEdgeType(item, parent, index),
				isMain: index === 0 && item.isMain && parent.isMain,
			});
		});
	}
	return edges;
}

function createBranchGroupKey(commit: LayoutCommit) {
	if (commit.isMain) return "main";
	if (commit.segmentId !== undefined) return `side:${commit.segmentId}`;
	return `commit:${commit.commit.oid}`;
}

function createEdgeType(
	from: LayoutCommit,
	to: LayoutCommit,
	parentIndex: number,
): RenderEdge["type"] {
	if (from.lane === to.lane) {
		return "branch";
	}

	if (parentIndex > 0 || from.lane < to.lane) {
		return "merge";
	}

	return "fork";
}

function createLabels(commits: LayoutCommit[]) {
	return commits.flatMap((commit): RenderLabel[] =>
		commit.refs.length > 0
			? [
					{
						row: commit.row,
						refs: commit.refs,
					},
				]
			: [],
	);
}

function compareRefs(a: RepoRef, b: RepoRef) {
	if (a.type !== b.type) return a.type === "branch" ? -1 : 1;
	if (a.name < b.name) return -1;
	if (a.name > b.name) return 1;
	return 0;
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
