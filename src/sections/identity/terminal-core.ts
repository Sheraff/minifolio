import {
	Bash,
	defineCommand,
	getCommandNames,
	getNetworkCommandNames,
	type BashExecResult,
	type CommandContext,
	type CommandName,
	type ExecResult,
} from "just-bash/browser";
import { QuotaFs, type QuotaFsOptions } from "./quota-fs.ts";

export type TerminalSession = {
	bash: Bash;
	cwd: string;
	previousCwd: string;
	env: Record<string, string>;
	history: string[];
	signals: TerminalSignals;
};

export type TerminalAutocompleteState = {
	bash: Pick<Bash, "fs">;
	cwd: string;
};

export type TerminalSessionOptions = {
	files: Record<string, string>;
	user?: string;
	timezone?: string;
	allowedUrlPrefixes?: string[];
	loadGitLog?: () => Promise<string>;
	exitCommand?: TerminalExitCommandOptions;
	commandOverrides?: TerminalCommandOverrides;
	quota?: QuotaFsOptions;
};

export type TerminalExitCommandOptions = {
	message?: string;
	requestExit?: boolean;
};

export type TerminalCommandHandler = (
	args: string[],
	ctx: CommandContext,
) => Promise<ExecResult>;
export type TerminalCommandOverrides = Record<
	string,
	TerminalCommandHandler | undefined
>;

export type TerminalExecutionResult = {
	command: string;
	output: string;
	didClear: boolean;
	exitRequested: boolean;
	exitCode: number;
};

type TerminalSignals = {
	clearGeneration: number;
	exitGeneration: number;
};

type InternalBashState = {
	state: {
		cwd: string;
		previousDir: string;
		env: Map<string, string>;
		shoptOptions: {
			expand_aliases: boolean;
		};
	};
};

const HOME = "/home/sheraff";

const CUSTOM_COMMAND_NAMES = [
	"clear",
	"exit",
	"git",
	"help",
	"history",
	"hostname",
	"id",
	"ll",
	"man",
	"mask",
	"portfolio",
	"ssh",
	"sudo",
	"uname",
	"wget",
	"whoami",
] as const;

const INTERNAL_CUSTOM_COMMAND_NAMES = [
	"minifolio-help",
	"minifolio-exit",
] as const;

const EXCLUDED_COMMANDS = new Set(["gzip", "gunzip", "zcat", "sqlite3"]);
const BASH_COMMANDS = getCommandNames().filter(
	(name): name is CommandName => !EXCLUDED_COMMANDS.has(name),
);
const NETWORK_COMMANDS = getNetworkCommandNames();
const COMPLETE_COMMANDS = [
	...new Set([...BASH_COMMANDS, ...NETWORK_COMMANDS, ...CUSTOM_COMMAND_NAMES]),
];
const GIT_SUBCOMMANDS = [
	"branch",
	"config",
	"log",
	"remote",
	"status",
] as const;
const GIT_REMOTE_URL = "https://github.com/Sheraff/minifolio.git";
const DEV_GIT_LOG =
	"git log is generated at build time and is available in production builds.\n";
const COMMAND_COMPLETION_COMMANDS = new Set(["which", "man"]);
const DIRECTORY_COMPLETION_COMMANDS = new Set(["cd", "pushd"]);
const TERMINAL_FS_QUOTA: QuotaFsOptions = {
	maxBytes: 5 * 1024 * 1024,
	maxFiles: 100,
};

export function createTerminalSession(
	options: TerminalSessionOptions,
): TerminalSession {
	const history: string[] = [];
	const signals: TerminalSignals = { clearGeneration: 0, exitGeneration: 0 };
	const user = options.user ?? "sheraff";
	const env: Record<string, string> = {
		HOME,
		USER: user,
		LOGNAME: user,
		HOSTNAME: "minifolio",
		PWD: HOME,
		OLDPWD: HOME,
		BASH_ALIAS_help: "minifolio-help",
		BASH_ALIAS_exit: "minifolio-exit",
	};

	if (options.timezone) env.TZ = options.timezone;

	const fs = new QuotaFs(options.files, options.quota ?? TERMINAL_FS_QUOTA);
	const bash = new Bash({
		fs,
		commands: BASH_COMMANDS,
		cwd: HOME,
		env,
		network: options.allowedUrlPrefixes?.length
			? {
					allowedUrlPrefixes: options.allowedUrlPrefixes,
				}
			: undefined,
		customCommands: createCustomCommands(history, signals, options),
	});

	const session = {
		bash,
		cwd: HOME,
		previousCwd: HOME,
		env: { ...bash.getEnv(), ...env },
		history,
		signals,
	};
	syncBashState(session);
	return session;
}

export async function executeTerminalCommand(
	session: TerminalSession,
	value: string,
): Promise<TerminalExecutionResult | undefined> {
	const input = value.trim();
	if (!input) return;

	session.history.push(input);

	try {
		const clearGeneration = session.signals.clearGeneration;
		const exitGeneration = session.signals.exitGeneration;
		syncBashState(session);
		const result = await session.bash.exec(input, {
			cwd: session.cwd,
			env: session.env,
		});
		session.env = result.env;
		session.cwd = result.env.PWD || session.cwd;
		session.previousCwd = result.env.OLDPWD || session.previousCwd;

		return {
			command: input,
			output: formatExecResult(result),
			didClear: session.signals.clearGeneration !== clearGeneration,
			exitRequested: session.signals.exitGeneration !== exitGeneration,
			exitCode: result.exitCode,
		};
	} catch (error) {
		return {
			command: input,
			output: error instanceof Error ? error.message : String(error),
			didClear: false,
			exitRequested: false,
			exitCode: 1,
		};
	}
}

export function normalizeTerminalFiles(
	rawFiles: Record<string, string>,
	prefix = "/fs",
) {
	return Object.fromEntries(
		Object.entries(rawFiles).map(([path, content]) => [
			path.startsWith(prefix) ? path.slice(prefix.length) : path,
			content,
		]),
	);
}

function createCustomCommands(
	history: string[],
	signals: TerminalSignals,
	options: TerminalSessionOptions,
) {
	const loadGitLog = options.loadGitLog ?? loadDefaultGitLog;
	const command = (name: string, execute: TerminalCommandHandler) =>
		defineCommand(name, options.commandOverrides?.[name] ?? execute);

	return [
		command("portfolio", async (_args, ctx) =>
			readVirtualFile(ctx, "/home/sheraff/about.txt"),
		),
		command("mask", async (_args, ctx) =>
			readVirtualFile(ctx, "/home/sheraff/documents/mask.txt"),
		),
		command("ll", async (args, ctx) =>
			execFromContext(ctx, ["ls", "-la", ...args].map(quoteArg).join(" ")),
		),
		command("clear", async () => {
			signals.clearGeneration++;
			return { stdout: "", stderr: "", exitCode: 0, stdoutKind: "text" };
		}),
		command("minifolio-help", async (_args, ctx) =>
			stdoutLine(formatHelp(ctx)),
		),
		command("whoami", async (_args, ctx) => stdoutLine(getUser(ctx))),
		command("hostname", async (args) => {
			if (args.length === 0) return stdoutLine("minifolio");
			if (args.length === 1 && args[0] === "-f")
				return stdoutLine("florianpellet.com");
			return stdoutLine(`hostname: unsupported option ${args[0]}`);
		}),
		command("git", async (args) => resolveGit(args, loadGitLog)),
		command("uname", async (args) =>
			stdoutLine(
				args.includes("-a")
					? "Portfolio minifolio 1.0.0 solidjs x86_64 delightful"
					: "Portfolio",
			),
		),
		command("id", async (_args, ctx) => {
			const user = getUser(ctx);
			return stdoutLine(
				`uid=1000(${user}) gid=1000(${user}) groups=1000(${user}),2024(frontend)`,
			);
		}),
		command("history", async () =>
			stdoutLine(
				history.map((entry, index) => `${index + 1}  ${entry}`).join("\n"),
			),
		),
		command("man", async (args) =>
			stdoutLine(
				args[0]
					? `No manual entry for ${args[0]}`
					: "What manual page do you want?",
			),
		),
		command("sudo", async () => stdoutLine("Nice try.")),
		command("wget", async () =>
			stdoutLine("wget: network access is disabled in this tiny universe"),
		),
		command("ssh", async () =>
			stdoutLine("ssh: network access is disabled in this tiny universe"),
		),
		command("minifolio-exit", async () => {
			if (options.exitCommand?.requestExit) signals.exitGeneration++;
			return stdoutLine(
				options.exitCommand?.message ?? "This terminal lives here now.",
			);
		}),
	];
}

function getUser(ctx: CommandContext) {
	return ctx.env.get("USER") || ctx.env.get("LOGNAME") || "sheraff";
}

async function readVirtualFile(
	ctx: CommandContext,
	path: string,
): Promise<ExecResult> {
	try {
		return {
			stdout: await ctx.fs.readFile(path),
			stderr: "",
			exitCode: 0,
			stdoutKind: "text",
		};
	} catch {
		return {
			stdout: "",
			stderr: `cat: ${path}: No such file or directory\n`,
			exitCode: 1,
			stdoutKind: "text",
		};
	}
}

async function execFromContext(
	ctx: CommandContext,
	command: string,
): Promise<ExecResult> {
	if (!ctx.exec)
		return {
			stdout: "",
			stderr: "shell execution is unavailable\n",
			exitCode: 1,
			stdoutKind: "text",
		};
	return ctx.exec(command, { cwd: ctx.cwd, env: Object.fromEntries(ctx.env) });
}

function formatHelp(ctx: CommandContext) {
	const customCommands = new Set<string>(CUSTOM_COMMAND_NAMES);
	const internalCommands = new Set<string>(INTERNAL_CUSTOM_COMMAND_NAMES);
	const nativeCommands = ctx.getRegisteredCommands?.() ?? [];
	const commands = [
		...new Set([
			...CUSTOM_COMMAND_NAMES,
			...nativeCommands.filter(
				(command) =>
					!customCommands.has(command) && !internalCommands.has(command),
			),
		]),
	].sort((left, right) => left.localeCompare(right));

	return formatColumns(commands);
}

function formatColumns(items: string[]) {
	const rowCount = Math.ceil(items.length / 2);
	const leftColumn = items.slice(0, rowCount);
	const rightColumn = items.slice(rowCount);
	const width = Math.max(...leftColumn.map((item) => item.length)) + 2;

	return leftColumn
		.map((item, index) => {
			const right = rightColumn[index];
			return right ? `${item.padEnd(width, " ")}${right}` : item;
		})
		.join("\n");
}

export async function resolveGit(
	args: string[],
	loadGitLog = loadDefaultGitLog,
) {
	if (args.length === 0) {
		return stdoutLine("usage: git [status|log|branch|config|remote]");
	}

	switch (args[0]) {
		case "status":
			return stdoutLine(
				"On branch main\nnothing to commit, working tree clean",
			);
		case "branch":
			return stdoutLine("* main");
		case "log":
			return stdoutText(await loadGitLog());
		case "config":
			if (
				args[1] === "user.email" ||
				(args[1] === "--get" && args[2] === "user.email")
			)
				return stdoutLine("me@florianpellet.com");
			if (
				args[1] === "user.name" ||
				(args[1] === "--get" && args[2] === "user.name")
			)
				return stdoutLine("Florian Pellet");
			return stdoutLine(
				"git config: only user.name and user.email are wired up here",
			);
		case "remote":
			if (args[1] === "-v" || args[1] === "--verbose")
				return stdoutLine(
					`origin\t${GIT_REMOTE_URL} (fetch)\norigin\t${GIT_REMOTE_URL} (push)`,
				);
			if (args[1] === "get-url" && args[2] === "origin")
				return stdoutLine(GIT_REMOTE_URL);
			return stdoutLine("origin");
		default:
			return stdoutLine(
				`git: '${args[0]}' is not a git command in this tiny demo`,
			);
	}
}

async function loadDefaultGitLog() {
	return DEV_GIT_LOG;
}

function stdoutLine(stdout: string): ExecResult {
	return {
		stdout: stdout ? `${stdout}\n` : "",
		stderr: "",
		exitCode: 0,
		stdoutKind: "text",
	};
}

function stdoutText(stdout: string): ExecResult {
	return { stdout, stderr: "", exitCode: 0, stdoutKind: "text" };
}

function quoteArg(arg: string) {
	return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function syncBashState(session: TerminalSession) {
	const state = (session.bash as unknown as InternalBashState).state;
	state.cwd = session.cwd;
	state.previousDir = session.previousCwd;
	state.env = new Map(Object.entries(session.env));
	state.shoptOptions.expand_aliases = true;
}

function formatExecResult(result: BashExecResult) {
	const output = result.stderr
		? `${result.stdout}${result.stdout && !result.stdout.endsWith("\n") ? "\n" : ""}${result.stderr}`
		: result.stdout;
	return output.replace(/\n$/, "");
}

export async function autocomplete(
	command: string,
	state: TerminalAutocompleteState,
): Promise<string> {
	const segment = getCompletionSegment(command);
	const completion = await autocompleteSegment(segment.command, state);
	return completion ? `${segment.prefix}${completion}` : "";
}

async function autocompleteSegment(
	command: string,
	state: TerminalAutocompleteState,
): Promise<string> {
	const rawTokens = command.match(/\S+/g) ?? [];
	if (rawTokens.length === 0) return "";

	const endsWithSpace = /\s$/.test(command);
	const effectiveCommand = rawTokens[0] ?? "";

	if (rawTokens.length === 1 && !endsWithSpace) {
		const completion = completeCandidate(COMPLETE_COMMANDS, rawTokens[0]);
		if (!completion || completion.value === rawTokens[0]) return "";
		return `${completion.value}${completion.isSingleMatch ? " " : ""}`;
	}

	if (
		COMMAND_COMPLETION_COMMANDS.has(effectiveCommand) &&
		rawTokens.length <= 2
	) {
		const target = endsWithSpace ? "" : rawTokens[rawTokens.length - 1];
		const completion = completeCandidate(COMPLETE_COMMANDS, target);
		if (!completion || completion.value === target) return "";
		return replaceLastToken(
			command,
			`${completion.value}${completion.isSingleMatch ? " " : ""}`,
			endsWithSpace,
		);
	}

	if (effectiveCommand === "git") {
		const target = endsWithSpace ? "" : rawTokens[rawTokens.length - 1];
		const shouldCompleteSubcommand =
			(rawTokens.length === 1 && endsWithSpace) ||
			(rawTokens.length === 2 && !rawTokens[1].startsWith("-"));
		if (shouldCompleteSubcommand) {
			const completion = completeCandidate(GIT_SUBCOMMANDS, target);
			if (!completion || completion.value === target) return "";
			return replaceLastToken(
				command,
				`${completion.value}${completion.isSingleMatch ? " " : ""}`,
				endsWithSpace,
			);
		}
	}

	const target = endsWithSpace ? "" : rawTokens[rawTokens.length - 1];
	if (target.startsWith("-")) return "";

	const completion = await completePath(target, state.cwd, state, {
		directoriesOnly: DIRECTORY_COMPLETION_COMMANDS.has(effectiveCommand),
		allowHidden:
			target.split("/").at(-1)?.startsWith(".") === true ||
			rawTokens
				.slice(1)
				.some((arg) => arg.startsWith("-") && arg.includes("a")),
	});
	if (!completion || completion === target) return "";
	return replaceLastToken(command, completion, endsWithSpace);
}

function getCompletionSegment(command: string) {
	let start = 0;
	let quote: '"' | "'" | undefined;
	let escaped = false;

	for (let index = 0; index < command.length; index++) {
		const char = command[index];

		if (escaped) {
			escaped = false;
			continue;
		}

		if (char === "\\" && quote !== "'") {
			escaped = true;
			continue;
		}

		if (quote) {
			if (char === quote) quote = undefined;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (char === ";" || char === "|") {
			start = index + (char === "|" && command[index + 1] === "|" ? 2 : 1);
			if (char === "|" && command[index + 1] === "|") index++;
			continue;
		}

		if (char === "&" && command[index + 1] === "&") {
			start = index + 2;
			index++;
		}
	}

	while (start < command.length && /\s/.test(command[start])) start++;
	return { prefix: command.slice(0, start), command: command.slice(start) };
}

function completeCandidate(candidates: readonly string[], fragment: string) {
	if (!fragment) return;

	const normalizedFragment = fragment.toLowerCase();
	const matches = [...candidates]
		.filter((candidate) =>
			candidate.toLowerCase().startsWith(normalizedFragment),
		)
		.sort((left, right) => left.localeCompare(right));

	if (matches.length === 0) return;
	if (matches.length === 1) return { value: matches[0], isSingleMatch: true };

	const commonPrefix = findCommonPrefix(matches);
	if (commonPrefix.length <= fragment.length) return;
	return { value: commonPrefix, isSingleMatch: false };
}

function findCommonPrefix(matches: readonly string[]) {
	let prefix = matches[0] ?? "";
	for (const match of matches.slice(1)) {
		let index = 0;
		while (
			index < prefix.length &&
			index < match.length &&
			prefix[index].toLowerCase() === match[index].toLowerCase()
		) {
			index++;
		}
		prefix = prefix.slice(0, index);
	}
	return prefix;
}

function replaceLastToken(
	command: string,
	replacement: string,
	endsWithSpace: boolean,
) {
	if (endsWithSpace) {
		return `${command}${replacement}`;
	}

	const lastWhitespace = command.search(/\s+[^\s]*$/);
	if (lastWhitespace === -1) return replacement;
	const prefix = command.slice(0, lastWhitespace).trimEnd();
	return `${prefix} ${replacement}`;
}

async function completePath(
	fragment: string,
	cwd: string,
	state: TerminalAutocompleteState,
	options: { directoriesOnly: boolean; allowHidden: boolean },
) {
	const slashIndex = fragment.lastIndexOf("/");
	const parentInput =
		slashIndex === -1 ? "" : fragment.slice(0, slashIndex) || "/";
	const partialName =
		slashIndex === -1 ? fragment : fragment.slice(slashIndex + 1);
	const directoryPath = resolvePath(cwd, parentInput || ".");

	let names: string[];
	try {
		names = await state.bash.fs.readdir(directoryPath);
	} catch {
		return "";
	}

	const entries = await Promise.all(
		names.map(async (name) => {
			try {
				return {
					name,
					stat: await state.bash.fs.stat(joinPath(directoryPath, name)),
				};
			} catch {
				return undefined;
			}
		}),
	);

	const candidates = entries
		.filter(
			(entry) =>
				entry && (options.allowHidden || !entry.name.startsWith(".")),
		)
		.filter(
			(entry) =>
				entry && (!options.directoriesOnly || entry.stat.isDirectory),
		);

	const completion = completeCandidate(
		candidates.map((entry) => entry!.name),
		partialName,
	);
	if (!completion) return "";

	const match = completion.isSingleMatch
		? candidates.find((entry) => entry?.name === completion.value)
		: undefined;
	const suffix = match ? (match.stat.isDirectory ? "/" : " ") : "";
	const base = parentInput
		? parentInput === "/"
			? "/"
			: `${parentInput}/`
		: "";
	return `${base}${completion.value}${suffix}`;
}

function resolvePath(cwd: string, input?: string) {
	if (!input || input === "~") return HOME;
	if (input.startsWith("~/"))
		return normalizePath(`${HOME}/${input.slice(2)}`);
	if (input.startsWith("/")) return normalizePath(input);
	return normalizePath(`${cwd}/${input}`);
}

function normalizePath(path: string) {
	const parts: string[] = [];
	for (const segment of path.split("/")) {
		if (!segment || segment === ".") continue;
		if (segment === "..") parts.pop();
		else parts.push(segment);
	}
	return `/${parts.join("/")}`;
}

function joinPath(parent: string, child: string) {
	return parent === "/" ? `/${child}` : `${parent}/${child}`;
}
