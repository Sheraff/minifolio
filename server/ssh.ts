// server/toy-ssh.ts
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
	createInterface,
	type AsyncCompleter,
	type Interface as ReadlineInterface,
} from "node:readline";
import ssh from "ssh2";
import {
	autocomplete,
	createTerminalSession,
	executeTerminalCommand,
} from "#client/sections/identity/terminal-core.ts";
import { publicLog } from "./public-logs.ts";
import type { ShutdownScope } from "./utils/shutdown.ts";

const MAX_CONCURRENT = 10;
const AUTH_TIMEOUT_MS = 10_000;
const SESSION_TIMEOUT_MS = 3_000;
const UNSUPPORTED_SESSION_CLOSE_DELAY_MS = 1_000;
const HOST_KEY_PATH = ".ssh_host_ed25519_key";
const TERMINAL_FILES_ROOT = "fs";
const CLIENT_GIT_LOG_PATH = "dist/client/git-log.txt";
const SSH_ALLOWED_URL_PREFIXES = ["https://florianpellet.com/api/"];
const MAX_PER_IP_CONNECTIONS = 2;
const DEFAULT_TERMINAL_COLUMNS = 80;
const DEFAULT_TERMINAL_ROWS = 24;

type TerminalSize = {
	columns: number;
	rows: number;
};

type ReadlineTerminalStream = ssh.ServerChannel & {
	columns?: number;
	rows?: number;
};

export function createSshServer(isDev: boolean, parentScope: ShutdownScope) {
	const hostKey = readHostKey(isDev);
	const terminalFiles = readTerminalFiles(TERMINAL_FILES_ROOT);
	const connectionsByIp = new Map<string, number>();
	const serverScope = parentScope.child("ssh server", {
		close: () => void server.close(),
	});

	const server = new ssh.Server(
		{
			hostKeys: [hostKey],
			algorithms: {
				kex: {
					remove: [
						"diffie-hellman-group-exchange-sha256",
						"diffie-hellman-group-exchange-sha1",
					],
				} as ssh.AlgorithmList<ssh.KexAlgorithm>,
			},
			keepaliveCountMax: 10,
		},
		(client, info) => {
			if (serverScope.closing) {
				client.end();
				return;
			}

			const ipConnections = connectionsByIp.get(info.ip) ?? 0;
			if (ipConnections >= MAX_PER_IP_CONNECTIONS) {
				publicLog(`[WARN] too many ssh connections`);
				console.log(`[ssh] ip rejected, too many connections ${info.ip}`);
				client.end();
				return;
			}
			connectionsByIp.set(info.ip, ipConnections + 1);

			let closed = false;
			const clientScope = serverScope.child("ssh client", {
				close: async ({ childrenClosed }) => {
					if (closed) return;
					client.noMoreSessions = true;
					await childrenClosed;
					if (!closed) client.end();
				},
				force: () => void client.end(),
			});

			let username = "";
			const authTimeout = setTimeout(() => client.end(), AUTH_TIMEOUT_MS);
			authTimeout.unref();

			client.on("error", (error) => {
				publicLog(`[WARN] ssh connection error`);
				console.warn("[ssh]", formatSshError(error));
			});

			client.on("close", () => {
				if (closed) return;
				closed = true;
				clientScope.done();
				clearTimeout(authTimeout);
				const ipConnections = connectionsByIp.get(info.ip);
				if (!ipConnections || ipConnections === 1) {
					connectionsByIp.delete(info.ip);
				} else {
					connectionsByIp.set(info.ip, ipConnections - 1);
				}
			});

			client.on("authentication", (ctx) => {
				username = ctx.username;

				// OpenSSH usually tries "none" first. Accepting it gives a passwordless toy login.
				if (ctx.method === "none") return ctx.accept();

				// Optional fallback if a client insists on prompting.
				if (ctx.method === "password") return ctx.accept();

				publicLog(`[ssh] rejected ${ctx.method} authentication`);
				ctx.reject(["none", "password"]);
			});

			client.on("ready", () => {
				let hasSession = false;
				clearTimeout(authTimeout);
				const sessionTimeout = setTimeout(
					() => client.end(),
					SESSION_TIMEOUT_MS,
				);
				sessionTimeout.unref();
				client.once("close", () => {
					if (hasSession) {
						publicLog("[ssh] session terminated");
					} else {
						publicLog("[ssh] probe");
					}
					clearTimeout(sessionTimeout);
				});
				client.on("session", (accept, reject) => {
					hasSession = true;
					if (clientScope.closing) {
						reject();
						return;
					}
					clearTimeout(sessionTimeout);

					const session = accept();
					publicLog("[ssh] session started");
					session.on("error", (error: unknown) => {
						publicLog(`[WARN] ssh session error`);
						console.warn("[ssh session]", formatSshError(error));
					});

					const terminalSize: TerminalSize = {
						columns: DEFAULT_TERMINAL_COLUMNS,
						rows: DEFAULT_TERMINAL_ROWS,
					};
					let shellStream: ssh.ServerChannel | undefined;

					session.on("pty", (accept, _reject, info) => {
						updateTerminalSize(terminalSize, info);
						if (typeof accept === "function") accept();
					});
					session.on("window-change", (accept, _reject, info) => {
						updateTerminalSize(terminalSize, info);
						if (shellStream) applyTerminalSize(shellStream, terminalSize, true);
						if (typeof accept === "function") accept();
					});
					session.on("exec", (accept, reject) => {
						acceptAndExit(accept, reject);
						client.noMoreSessions = true;
						setTimeout(() => {
							if (!closed) client.end();
						}, UNSUPPORTED_SESSION_CLOSE_DELAY_MS).unref();
					});
					session.on("subsystem", simpleReject);
					session.on("sftp", simpleReject);
					session.on("signal", simpleAccept);

					session.on("shell", (accept, reject) => {
						if (clientScope.closing) {
							reject();
							return;
						}

						publicLog("[ssh] shell access granted");
						const stream = accept();
						shellStream = stream;

						const streamScope = clientScope.child("ssh shell session", {
							close: () => closeSshShell(stream),
							force: () => void stream.destroy(),
						});
						stream.once("close", () => {
							if (shellStream === stream) shellStream = undefined;
							streamScope.done();
							publicLog("[ssh] shell session terminated");
						});

						interactiveStream(
							username,
							info,
							stream,
							terminalFiles,
							terminalSize,
							isDev,
						);
					});
				});
			});
		},
	);
	server.maxConnections = MAX_CONCURRENT;

	server.on("error", (error: unknown) => {
		publicLog(`[WARN] ssh server error`);
		console.warn("[ssh]", formatSshError(error));
	});
	server.once("close", () => serverScope.done());

	return server;
}

function closeSshShell(stream: ssh.ServerChannel) {
	if (stream.closed || stream.destroyed) return;
	stream.exit(0);
	stream.destroy();
}

function readHostKey(isDev: boolean) {
	try {
		return readFileSync(HOST_KEY_PATH);
	} catch (error) {
		if (!isDev) {
			throw new Error(
				`[ssh] Unable to read SSH host key at ${HOST_KEY_PATH}: ${formatSshError(error)}`,
			);
		}

		console.warn(
			`[ssh] No readable SSH host key found at ${HOST_KEY_PATH}; generating ephemeral dev key.`,
		);
		return ssh.utils.generateKeyPairSync("ed25519").private;
	}
}

function formatSshError(error: unknown) {
	if (!(error instanceof Error)) return String(error);
	const metadata = error as Error & {
		level?: unknown;
		fatal?: unknown;
		code?: unknown;
	};
	const details = [
		typeof metadata.level === "string"
			? `level=${metadata.level}`
			: undefined,
		typeof metadata.fatal === "boolean"
			? `fatal=${metadata.fatal}`
			: undefined,
		metadata.code ? `code=${metadata.code}` : undefined,
	]
		.filter(Boolean)
		.join(" ");

	return details ? `${error.message} (${details})` : error.message;
}

function simpleReject(
	_accept: ssh.AcceptConnection<ssh.ServerChannel>,
	reject: ssh.RejectConnection,
) {
	if (typeof reject === "function") reject();
}

function simpleAccept(
	accept: ssh.AcceptConnection<ssh.ServerChannel>,
	_reject: ssh.RejectConnection,
) {
	if (typeof accept === "function") accept();
}

function acceptAndExit(
	accept: ssh.AcceptConnection<ssh.ServerChannel>,
	_reject: ssh.RejectConnection,
) {
	const stream = accept();
	handleStreamError(stream);
	stream.on("data", () => {});
	stream.stderr.write(
		"This SSH server only supports the interactive shell.\r\n",
	);
	stream.exit(127);
	stream.end();
}

function interactiveStream(
	username: string,
	info: ssh.ClientInfo,
	stream: ssh.ServerChannel,
	terminalFiles: Record<string, string>,
	terminalSize: TerminalSize,
	isDev: boolean,
) {
	handleStreamError(stream);
	applyTerminalSize(stream, terminalSize);
	const terminalUser = username || "user";
	const terminal = createTerminalSession({
		files: { ...terminalFiles },
		user: terminalUser,
		allowedUrlPrefixes: SSH_ALLOWED_URL_PREFIXES,
		...(isDev ? {} : { loadGitLog: readSshGitLog }),
		exitCommand: {
			message: exitMessage(username),
			requestExit: true,
		},
	});
	let pending = Promise.resolve();
	let readlineClosed = false;

	function promptText() {
		return `${terminalUser}@minifolio:~$ `;
	}

	async function runCommand(command: string) {
		const result = await executeTerminalCommand(terminal, command);
		if (!result) return;

		if (result.didClear) stream.write("\x1b[2J\x1b[H");
		writeTerminalOutput(stream, result.output);
		if (result.exitRequested) stream.end();
	}

	const completer: AsyncCompleter = (line, callback) => {
		void autocomplete(line, terminal).then(
			(suggestion) => {
				callback(null, [
					suggestion && suggestion !== line ? [suggestion] : [],
					line,
				]);
			},
			(error: unknown) => {
				callback(error instanceof Error ? error : new Error(String(error)));
			},
		);
	};

	const rl = createInterface({
		input: stream,
		output: stream,
		terminal: true,
		prompt: promptText(),
		historySize: 1_000,
		completer,
	});

	stream.write(helloMessage(username, info));
	stream.write("\r\n");
	rl.prompt();

	rl.on("line", (line) => {
		pending = pending
			.then(() => executeReadlineCommand(rl, stream, line, runCommand))
			.catch((error: unknown) => {
				if (stream.writableEnded || stream.destroyed) return;
				stream.write(`${formatSshError(error)}\r\n`);
				rl.prompt();
			});
	});
	rl.on("SIGINT", () => {
		clearReadlineInput(rl);
		stream.write("^C\r\n");
		rl.prompt();
	});
	rl.on("error", (error: Error) => {
		publicLog(`[WARN] ssh readline error`);
		console.warn("[ssh readline]", formatSshError(error));
	});
	rl.once("close", () => {
		readlineClosed = true;
		if (!stream.closed && !stream.destroyed && !stream.writableEnded)
			stream.end();
	});
	stream.once("close", () => {
		if (!readlineClosed) rl.close();
	});
}

async function executeReadlineCommand(
	rl: ReadlineInterface,
	stream: ssh.ServerChannel,
	line: string,
	runCommand: (command: string) => Promise<void>,
) {
	rl.pause();
	try {
		await runCommand(line);
	} catch (error) {
		if (!stream.writableEnded && !stream.destroyed) {
			stream.write(`${formatSshError(error)}\r\n`);
		}
	} finally {
		if (!stream.writableEnded && !stream.destroyed) {
			rl.resume();
			rl.prompt();
		}
	}
}

function clearReadlineInput(rl: ReadlineInterface) {
	rl.write(null, { ctrl: true, name: "u" });
	rl.write(null, { ctrl: true, name: "k" });
}

function updateTerminalSize(
	terminalSize: TerminalSize,
	info: ssh.PseudoTtyInfo | ssh.WindowChangeInfo,
) {
	terminalSize.columns = normalizeTerminalDimension(
		info.cols,
		terminalSize.columns,
	);
	terminalSize.rows = normalizeTerminalDimension(info.rows, terminalSize.rows);
}

function normalizeTerminalDimension(value: number, fallback: number) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function applyTerminalSize(
	stream: ssh.ServerChannel,
	terminalSize: TerminalSize,
	emitResize = false,
) {
	const terminalStream = stream as ReadlineTerminalStream;
	terminalStream.columns = terminalSize.columns;
	terminalStream.rows = terminalSize.rows;
	if (emitResize) terminalStream.emit("resize");
}

function writeTerminalOutput(stream: ssh.ServerChannel, output: string) {
	if (!output) return;
	stream.write(`${output.replace(/\n/g, "\r\n")}\r\n`);
}

async function readSshGitLog() {
	return readFileSync(CLIENT_GIT_LOG_PATH, "utf8");
}

function readTerminalFiles(root: string) {
	const files: Record<string, string> = {};
	walkTerminalFiles(root, root, files);
	return files;
}

function walkTerminalFiles(
	root: string,
	directory: string,
	files: Record<string, string>,
) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			walkTerminalFiles(root, path, files);
		} else if (entry.isFile()) {
			const virtualPath = `/${relative(root, path).split(sep).join("/")}`;
			files[virtualPath] = readFileSync(path, "utf8");
		}
	}
}

function handleStreamError(stream: ssh.ServerChannel) {
	stream.on("error", (error: unknown) => {
		publicLog(`[WARN] ssh stream error`);
		console.warn("[ssh stream]", formatSshError(error));
	});
	stream.stderr.on("error", (error: unknown) => {
		publicLog(`[WARN] ssh stream error`);
		console.warn("[ssh stderr]", formatSshError(error));
	});
}

function exitMessage(username: string) {
	return `
teardown ssh://minifolio

edge removed:
[${username}] ──X── [minifolio]

status: 200 goodbye
Thanks for the packets.
`;
}

function helloMessage(username: string, info: ssh.ClientInfo) {
	return `
scan minifolio

PORT     STATE  SERVICE
22/tcp   open   ssh
79/tcp   open   finger
443/tcp  open   web
???      close  loose ideas

[${username}] ──── tcp/22 ───> [minifolio]
  |
  +-- ip:    ${info.ip}
  +-- port:  ${info.port}
  +-- ident: ${info.header.identRaw}

status: connected
`
		.split("\n")
		.join("\r\n");
}
