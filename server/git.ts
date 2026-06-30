import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { publicLog } from "./public-logs.ts";
import type { ShutdownScope } from "./utils/shutdown.ts";

const MAX_CONCURRENT = 10;
const INITIAL_REQUEST_TIMEOUT_MS = 5_000;
const ERROR_CLOSE_TIMEOUT_MS = 1_000;
const MAX_FIRST_PACKET_BYTES = 4_096;
const MAX_STDERR_LOG_BYTES = 2_048;

const MINIFOLIO_REPO_PATH = resolve("dist/minifolio.git");
const SAFE_GIT_HOME = mkdtempSync(join(tmpdir(), "minifolio-git-home-"));
const SAFE_GIT_LOCALE_KEYS = ["LANG", "LC_ALL", "LC_CTYPE"] as const;
const REPOSITORIES = new Map([
	["/", MINIFOLIO_REPO_PATH],
	["/minifolio.git", MINIFOLIO_REPO_PATH],
]);

type GitRequest = {
	repoName: string;
	repoPath: string;
	gitProtocol?: string;
};

type ParsedGitRequest =
	| { success: true; request: GitRequest }
	| { success: false; message: string; log: string };

export function createGitServer(parentScope: ShutdownScope) {
	const serverScope = parentScope.child("git server", {
		close: () => void server.close(),
	});
	const server = createServer((socket) => {
		if (serverScope.closing) {
			socket.destroy();
			return;
		}

		handleGitSocket(socket, serverScope);
	});

	server.maxConnections = MAX_CONCURRENT;
	server.on("error", (error: unknown) => {
		publicLog(`[WARN] git server error`);
		console.warn("[git]", formatError(error));
	});
	server.once("close", () => serverScope.done());

	return server;
}

function handleGitSocket(socket: Socket, serverScope: ShutdownScope) {
	let uploadPack: ChildProcessWithoutNullStreams | undefined;
	let uploadPackClosed = false;
	let uploadPackSpawnFailed = false;
	let initialRequest = Buffer.alloc(0);

	const clientScope = serverScope.child("git client", {
		close: () => {
			if (uploadPack && !uploadPackClosed) uploadPack.kill("SIGTERM");
			if (!socket.destroyed && !socket.writableEnded) socket.end();
		},
		force: () => {
			if (uploadPack && !uploadPackClosed) uploadPack.kill("SIGKILL");
			if (!socket.destroyed) socket.destroy();
		},
	});

	const onInitialTimeout = () => {
		stopReadingInitialRequest();
		publicLog(`[WARN] git initial request timeout`);
		sendGitError(socket, "timeout waiting for git request");
	};

	socket.setTimeout(INITIAL_REQUEST_TIMEOUT_MS);
	socket.on("timeout", onInitialTimeout);
	socket.on("data", onInitialData);
	socket.on("error", (error: unknown) => {
		publicLog(`[WARN] git socket error`);
		console.warn("[git socket]", formatError(error));
	});
	socket.once("close", () => {
		stopReadingInitialRequest();
		if (uploadPack && !uploadPackClosed) uploadPack.kill("SIGTERM");
		clientScope.done();
	});

	function onInitialData(chunk: Buffer) {
		if (clientScope.closing) return;

		initialRequest = Buffer.concat([initialRequest, chunk]);
		if (initialRequest.length < 4) return;

		const packetLength = readPacketLength(initialRequest);
		if (packetLength === undefined || packetLength < 5) {
			stopReadingInitialRequest();
			publicLog(`[WARN] git malformed request`);
			sendGitError(socket, "malformed git request");
			return;
		}

		if (packetLength > MAX_FIRST_PACKET_BYTES) {
			stopReadingInitialRequest();
			publicLog(`[WARN] git oversized request`);
			sendGitError(socket, "git request is too large");
			return;
		}

		if (initialRequest.length < packetLength) return;

		stopReadingInitialRequest();
		socket.pause();

		const packet = initialRequest.subarray(0, packetLength);
		const pendingInput = initialRequest.subarray(packetLength);
		const parsed = parseGitRequest(packet);
		if (!parsed.success) {
			publicLog(parsed.log);
			sendGitError(socket, parsed.message);
			return;
		}

		startUploadPack(parsed.request, pendingInput);
	}

	function stopReadingInitialRequest() {
		socket.off("data", onInitialData);
		socket.off("timeout", onInitialTimeout);
		socket.setTimeout(0);
	}

	function startUploadPack(request: GitRequest, pendingInput: Buffer) {
		if (!bareRepoExists(request.repoPath)) {
			publicLog(`[WARN] git repository missing`);
			sendGitError(
				socket,
				"repository artifact missing; run pnpm git:build",
			);
			return;
		}

		const env = createUploadPackEnv(request.gitProtocol);

		try {
			uploadPack = spawn(
				"git",
				["upload-pack", "--strict", request.repoPath],
				{ env, stdio: ["pipe", "pipe", "pipe"] },
			);
		} catch (error) {
			publicLog(`[WARN] git upload-pack error`);
			console.warn("[git upload-pack]", formatError(error));
			sendGitError(socket, "git upload-pack unavailable");
			return;
		}

		publicLog(`[git] upload-pack ${request.repoName}`);

		let stderr = "";
		uploadPack.stderr.on("data", (chunk: Buffer) => {
			if (stderr.length >= MAX_STDERR_LOG_BYTES) return;
			stderr += chunk
				.toString("utf8")
				.slice(0, MAX_STDERR_LOG_BYTES - stderr.length);
		});
		uploadPack.stderr.on("error", (error: unknown) => {
			if (!isExpectedPipeError(error)) {
				console.warn("[git upload-pack stderr]", formatError(error));
			}
		});
		uploadPack.stdin.on("error", (error: unknown) => {
			if (!isExpectedPipeError(error)) {
				console.warn("[git upload-pack stdin]", formatError(error));
			}
		});
		uploadPack.stdout.on("error", (error: unknown) => {
			if (!isExpectedPipeError(error)) {
				console.warn("[git upload-pack stdout]", formatError(error));
			}
		});
		uploadPack.once("error", (error: unknown) => {
			uploadPackSpawnFailed = true;
			publicLog(`[WARN] git upload-pack error`);
			console.warn("[git upload-pack]", formatError(error));
			sendGitError(socket, "git upload-pack unavailable");
		});
		uploadPack.once("close", (code, signal) => {
			uploadPackClosed = true;
			if (!uploadPackSpawnFailed && code !== 0) {
				publicLog(`[WARN] git upload-pack exited`);
				console.warn(
					`[git upload-pack] exited code=${String(code)} signal=${String(signal)}`,
					stderr.trim(),
				);
			}
			if (!socket.destroyed && !socket.writableEnded) socket.end();
		});

		if (pendingInput.length > 0) uploadPack.stdin.write(pendingInput);
		socket.pipe(uploadPack.stdin);
		uploadPack.stdout.pipe(socket);
		socket.resume();
	}
}

function parseGitRequest(packet: Buffer): ParsedGitRequest {
	const payload = packet.subarray(4);
	const commandEnd = payload.indexOf(0);
	if (commandEnd <= 0) {
		return {
			success: false,
			message: "malformed git request",
			log: `[WARN] git malformed request`,
		};
	}

	const command = payload.toString("utf8", 0, commandEnd);
	const commandMatch = /^([a-z0-9-]+) (\/[^ ]*)$/.exec(command);
	if (!commandMatch) {
		return {
			success: false,
			message: "malformed git request",
			log: `[WARN] git malformed request`,
		};
	}

	const [, service, repoName] = commandMatch;
	if (service !== "git-upload-pack") {
		return {
			success: false,
			message: "unsupported git service",
			log: `[WARN] git unsupported service`,
		};
	}

	const repoPath = REPOSITORIES.get(repoName);
	if (!repoPath) {
		return {
			success: false,
			message: "repository not found",
			log: `[WARN] git unknown repository`,
		};
	}

	const fields = splitNulFields(payload.subarray(commandEnd + 1));
	const extraSeparator = fields.indexOf("");
	const metadataFields =
		extraSeparator === -1 ? fields : fields.slice(0, extraSeparator);
	const protocolFields =
		extraSeparator === -1
			? []
			: fields.slice(extraSeparator + 1).filter(Boolean);

	if (
		!metadataFields.some(
			(field) => field.startsWith("host=") && field.length > 5,
		)
	) {
		return {
			success: false,
			message: "malformed git request",
			log: `[WARN] git malformed request`,
		};
	}

	if (!protocolFields.every(isSafeProtocolField)) {
		return {
			success: false,
			message: "malformed git protocol parameters",
			log: `[WARN] git malformed protocol parameters`,
		};
	}

	return {
		success: true,
		request: {
			repoName,
			repoPath,
			gitProtocol:
				protocolFields.length > 0 ? protocolFields.join(":") : undefined,
		},
	};
}

function readPacketLength(buffer: Buffer) {
	const header = buffer.toString("ascii", 0, 4);
	if (!/^[0-9a-fA-F]{4}$/.test(header)) return undefined;
	return Number.parseInt(header, 16);
}

function splitNulFields(buffer: Buffer) {
	const fields: string[] = [];
	let start = 0;
	for (let i = 0; i < buffer.length; i++) {
		if (buffer[i] !== 0) continue;
		fields.push(buffer.toString("utf8", start, i));
		start = i + 1;
	}
	if (start < buffer.length) fields.push(buffer.toString("utf8", start));
	return fields;
}

function isSafeProtocolField(field: string) {
	return /^[A-Za-z0-9][A-Za-z0-9-]*=[A-Za-z0-9./_-]+$/.test(field);
}

function createUploadPackEnv(gitProtocol: string | undefined) {
	const env: NodeJS.ProcessEnv = {
		GIT_CONFIG_NOSYSTEM: "1",
		HOME: SAFE_GIT_HOME,
		PATH: "/usr/bin:/bin",
	};

	for (const key of SAFE_GIT_LOCALE_KEYS) {
		const value = process.env[key];
		if (value) env[key] = value;
	}

	if (gitProtocol) env.GIT_PROTOCOL = gitProtocol;

	return env;
}

function bareRepoExists(repoPath: string) {
	try {
		return statSync(repoPath).isDirectory();
	} catch {
		return false;
	}
}

function sendGitError(socket: Socket, message: string) {
	if (socket.destroyed || socket.writableEnded) return;

	const payload = Buffer.from(`ERR ${message}\n`, "utf8");
	const header = Buffer.from(
		(payload.length + 4).toString(16).padStart(4, "0"),
		"ascii",
	);
	socket.end(Buffer.concat([header, payload]));
	setTimeout(() => {
		if (!socket.destroyed) socket.destroy();
	}, ERROR_CLOSE_TIMEOUT_MS).unref();
}

function isExpectedPipeError(error: unknown) {
	return (
		error instanceof Error &&
		["EPIPE", "ECONNRESET"].includes(
			String((error as NodeJS.ErrnoException).code),
		)
	);
}

function formatError(error: unknown) {
	if (!(error instanceof Error)) return String(error);
	const code = (error as NodeJS.ErrnoException).code;
	return code ? `${error.message} (${code})` : error.message;
}
