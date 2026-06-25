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
const SSH_SHELL_IDLE_TIMEOUT_MS = 2 * 60_000;
const SSH_SHELL_MAX_SESSION_AGE_MS = 15 * 60_000;
const UNSUPPORTED_SESSION_CLOSE_DELAY_MS = 1_000;
const SSH_JAIL_WINDOW_MS = 5 * 60_000;
const SSH_JAIL_FAILURE_LIMIT = 6;
const SSH_JAIL_BASE_MS = 10 * 60_000;
const SSH_JAIL_MAX_MS = 60 * 60_000;
const SSH_JAIL_CLEANUP_INTERVAL_MS = 10 * 60_000;
const SSH_JAIL_REJECT_LOG_INTERVAL_MS = 60_000;
const SSH_CLIENT_ERROR_FAILURE_SCORE = 2;
const SSH_CONNECTION_LIMIT_FAILURE_SCORE = 2;
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

type SshJailEntry = {
	failures: number;
	windowStartedAt: number;
	lastFailureAt: number;
	jailedUntil: number;
	jailCount: number;
	lastJailRejectLogAt: number;
};

export function createSshServer(isDev: boolean, parentScope: ShutdownScope) {
	const hostKey = readHostKey(isDev);
	const terminalFiles = readTerminalFiles(TERMINAL_FILES_ROOT);

	const connectionsByIp = new Map<string, number>();

	const jailByIp = new Map<string, SshJailEntry>();
	const jailCleanup = setInterval(
		() => pruneSshJail(jailByIp),
		SSH_JAIL_CLEANUP_INTERVAL_MS,
	).unref();

	const serverScope = parentScope.child("ssh server", {
		close: () => {
			clearInterval(jailCleanup);
			void server.close();
		},
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
			let acceptedAuth = false;
			let connectionFailureRecorded = false;
			const noteConnectionFailure = (reason: string, score = 1) => {
				if (serverScope.closing) return;
				connectionFailureRecorded = true;
				recordSshFailure(jailByIp, info.ip, reason, score);
			};

			client.on("error", (error) => {
				publicLog(`[WARN] ssh connection error`);
				console.warn("[ssh]", formatSshError(error));
				noteConnectionFailure(
					"client error",
					SSH_CLIENT_ERROR_FAILURE_SCORE,
				);
			});

			if (serverScope.closing) {
				client.end();
				return;
			}

			const activeJail = getActiveSshJail(jailByIp, info.ip);
			if (activeJail) {
				logSshJailRejection(info.ip, activeJail);
				client.end();
				return;
			}

			const ipConnections = connectionsByIp.get(info.ip) ?? 0;
			if (ipConnections >= MAX_PER_IP_CONNECTIONS) {
				publicLog(`[WARN] too many ssh connections`);
				console.log(`[ssh] ip rejected, too many connections ${info.ip}`);
				noteConnectionFailure(
					"too many concurrent connections",
					SSH_CONNECTION_LIMIT_FAILURE_SCORE,
				);
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

			client.on("close", () => {
				if (closed) return;
				closed = true;
				clientScope.done();
				clearTimeout(authTimeout);
				if (!acceptedAuth && !connectionFailureRecorded) {
					noteConnectionFailure("pre-auth disconnect");
				}
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
				if (ctx.method === "none") {
					acceptedAuth = true;
					return ctx.accept();
				}

				// Optional fallback if a client insists on prompting.
				if (ctx.method === "password") {
					acceptedAuth = true;
					return ctx.accept();
				}

				publicLog(`[ssh] rejected ${ctx.method} authentication`);
				noteConnectionFailure(`rejected ${ctx.method} authentication`);
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
						noteConnectionFailure("probe");
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
						if (shellStream)
							applyTerminalSize(shellStream, terminalSize, true);
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
	server.once("close", () => {
		clearInterval(jailCleanup);
		serverScope.done();
	});

	return server;
}

function getActiveSshJail(jailByIp: Map<string, SshJailEntry>, ip: string) {
	const entry = jailByIp.get(ip);
	if (!entry) return;
	if (entry.jailedUntil > Date.now()) return entry;
}

function recordSshFailure(
	jailByIp: Map<string, SshJailEntry>,
	ip: string,
	reason: string,
	score = 1,
) {
	const now = Date.now();
	const current = jailByIp.get(ip);
	const inWindow =
		current && now - current.windowStartedAt <= SSH_JAIL_WINDOW_MS;
	const entry: SshJailEntry = inWindow
		? current
		: {
				failures: 0,
				windowStartedAt: now,
				lastFailureAt: now,
				jailedUntil: current?.jailedUntil ?? 0,
				jailCount: current?.jailCount ?? 0,
				lastJailRejectLogAt: current?.lastJailRejectLogAt ?? 0,
			};

	entry.lastFailureAt = now;
	if (entry.jailedUntil > now) {
		jailByIp.set(ip, entry);
		return;
	}

	entry.failures += score;
	if (entry.failures >= SSH_JAIL_FAILURE_LIMIT) {
		entry.jailCount += 1;
		const duration = Math.min(
			SSH_JAIL_BASE_MS * 2 ** (entry.jailCount - 1),
			SSH_JAIL_MAX_MS,
		);
		entry.failures = 0;
		entry.windowStartedAt = now;
		entry.jailedUntil = now + duration;
		entry.lastJailRejectLogAt = now;
		publicLog(`[WARN] ssh connection cooldown`);
		console.warn(
			`[ssh] ip jailed ${ip} for ${formatDuration(duration)} after ${reason}`,
		);
	}

	jailByIp.set(ip, entry);
}

function logSshJailRejection(ip: string, entry: SshJailEntry) {
	const now = Date.now();
	if (now - entry.lastJailRejectLogAt < SSH_JAIL_REJECT_LOG_INTERVAL_MS)
		return;
	entry.lastJailRejectLogAt = now;
	publicLog(`[WARN] ssh connection cooldown`);
	console.log(
		`[ssh] ip rejected, cooldown ${ip} ${formatDuration(entry.jailedUntil - now)}`,
	);
}

function pruneSshJail(jailByIp: Map<string, SshJailEntry>) {
	const now = Date.now();
	for (const [ip, entry] of jailByIp) {
		const quietFor = now - entry.lastFailureAt;
		if (entry.jailedUntil <= now && quietFor > SSH_JAIL_WINDOW_MS) {
			jailByIp.delete(ip);
		}
	}
}

function formatDuration(ms: number) {
	return `${Math.max(1, Math.ceil(ms / 1000))}s`;
}

function closeSshShell(stream: ssh.ServerChannel) {
	if (stream.closed || stream.destroyed) return;
	stream.exit(0);
	stream.destroy();
}

function enforceSshShellTimeouts(stream: ssh.ServerChannel) {
	let idleTimeout: NodeJS.Timeout | undefined;
	let expired = false;
	let cleanedUp = false;

	const maxAgeTimeout = setTimeout(() => {
		expire(
			"session timeout",
			"maximum session age reached; closing SSH shell.",
		);
	}, SSH_SHELL_MAX_SESSION_AGE_MS).unref();

	function resetIdleTimeout() {
		if (cleanedUp) return;
		if (idleTimeout) clearTimeout(idleTimeout);
		idleTimeout = setTimeout(() => {
			expire("idle timeout", "idle timeout; closing SSH shell.");
		}, SSH_SHELL_IDLE_TIMEOUT_MS).unref();
	}

	function expire(reason: string, message: string) {
		if (expired) return;
		expired = true;
		cleanup();
		if (stream.closed || stream.destroyed) return;

		publicLog(`[ssh] shell ${reason}`);
		endSshShell(stream, message);
	}

	function cleanup() {
		if (cleanedUp) return;
		cleanedUp = true;
		clearTimeout(maxAgeTimeout);
		if (idleTimeout) clearTimeout(idleTimeout);
		stream.off("data", resetIdleTimeout);
	}

	stream.on("data", resetIdleTimeout);
	resetIdleTimeout();
	stream.once("close", cleanup);
}

function endSshShell(stream: ssh.ServerChannel, message: string) {
	if (stream.closed || stream.destroyed) return;
	if (!stream.writableEnded) {
		stream.write(`\r\n${message}\r\n`);
		stream.exit(0);
		stream.end();
	}

	setTimeout(() => {
		if (!stream.closed && !stream.destroyed) stream.destroy();
	}, UNSUPPORTED_SESSION_CLOSE_DELAY_MS).unref();
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

	function promptText() {
		return `\x1b[1;32m${terminalUser}@minifolio:~$\x1b[0m `;
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
	enforceSshShellTimeouts(stream);

	stream.write(helloMessage(username, info));
	stream.write("\r\n");
	rl.prompt();

	let pending = Promise.resolve();
	rl.on("line", (line) => {
		const self = (pending = pending
			.then(() => executeReadlineCommand(rl, stream, line, runCommand))
			.catch((error: unknown) => {
				if (stream.writableEnded || stream.destroyed) return;
				stream.write(`${formatSshError(error)}\r\n`);
				rl.prompt();
			})
			.then(() => {
				if (self === pending) pending = Promise.resolve();
			}));
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

	let readlineClosed = false;
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
