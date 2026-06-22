// server/toy-ssh.ts
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ssh from "ssh2";
import {
	autocomplete,
	createTerminalSession,
	executeTerminalCommand,
} from "#client/sections/identity/terminal-core.ts";
import { publicLog } from "./public-logs.ts";

const MAX_CONCURRENT = 10;
const AUTH_TIMEOUT_MS = 10_000;
const SESSION_TIMEOUT_MS = 3_000;
const HOST_KEY_PATH = ".ssh_host_ed25519_key";
const TERMINAL_FILES_ROOT = "fs";
const CLIENT_GIT_LOG_PATH = "dist/client/git-log.txt";
const SSH_ALLOWED_URL_PREFIXES = ["https://florianpellet.com/api/"];

export function createSshServer(isDev: boolean) {
	const hostKey = readHostKey(isDev);
	const terminalFiles = readTerminalFiles(TERMINAL_FILES_ROOT);

	const server = new ssh.Server(
		{
			hostKeys: [hostKey],
			// TODO: make a cool multiline banner with some ascii art
			banner: "Hello from minifolio",
			keepaliveCountMax: 10,
		},
		(client, info) => {
			let username = "";
			const authTimeout = setTimeout(() => client.end(), AUTH_TIMEOUT_MS);
			authTimeout.unref();

			client.on("error", (error) => {
				console.warn("[ssh]", formatSshError(error));
			});

			let closed = false;
			client.on("close", () => {
				if (closed) return;
				closed = true;
				clearTimeout(authTimeout);
			});

			client.on("authentication", (ctx) => {
				username = ctx.username;

				// OpenSSH usually tries "none" first. Accepting it gives a passwordless toy login.
				if (ctx.method === "none") return ctx.accept();

				// Optional fallback if a client insists on prompting.
				if (ctx.method === "password") return ctx.accept();

				ctx.reject(["none", "password"]);
			});

			client.on("ready", () => {
				clearTimeout(authTimeout);
				const sessionTimeout = setTimeout(
					() => client.end(),
					SESSION_TIMEOUT_MS,
				);
				sessionTimeout.unref();
				client.once("close", () => {
					publicLog("[ssh] shell session terminated");
					clearTimeout(sessionTimeout);
				});
				client.on("session", (accept, _reject) => {
					clearTimeout(sessionTimeout);

					const session = accept();
					session.on("error", (error: unknown) => {
						console.warn("[ssh session]", formatSshError(error));
					});

					session.on("pty", simpleAccept);
					session.on("exec", acceptAndExit);
					session.on("subsystem", simpleReject);
					session.on("sftp", simpleReject);
					session.on("signal", simpleAccept);

					session.on("shell", (accept) => {
						publicLog("[ssh] shell access granted");
						const stream = accept();
						interactiveStream(
							username,
							info,
							stream,
							terminalFiles,
							isDev,
						);
					});
				});
			});
		},
	);
	server.maxConnections = MAX_CONCURRENT;

	server.on("error", (error: unknown) => {
		console.warn("[ssh]", formatSshError(error));
	});

	return server;
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
	reject();
}

function simpleAccept(
	accept: ssh.AcceptConnection<ssh.ServerChannel>,
	_reject: ssh.RejectConnection,
) {
	accept();
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
	isDev: boolean,
) {
	handleStreamError(stream);
	const terminalUser = username || "user";
	const terminal = createTerminalSession({
		files: { ...terminalFiles },
		user: terminalUser,
		allowedUrlPrefixes: SSH_ALLOWED_URL_PREFIXES,
		...(isDev ? {} : { loadGitLog: readSshGitLog }),
		exitCommand: {
			message: "bye",
			requestExit: true,
		},
	});
	let input = "";
	let escapeBuffer: number[] = [];
	let historyCursor = terminal.history.length;
	let historyDraft = "";
	let pending = Promise.resolve();

	function promptText() {
		return `${terminalUser}@minifolio:~$ `;
	}

	function prompt() {
		stream.write(promptText());
	}

	function redrawInput(value: string) {
		input = value;
		stream.write(`\r\x1b[2K${promptText()}${input}`);
	}

	function resetHistoryCursor() {
		historyCursor = terminal.history.length;
		historyDraft = "";
	}

	function resetHistoryAfterEdit() {
		if (historyCursor !== terminal.history.length) resetHistoryCursor();
	}

	function ringBell() {
		stream.write("\x07");
	}

	function queueInput(chunk: Uint8Array) {
		pending = pending
			.then(() => processInput(chunk))
			.catch((error) => {
				if (stream.writableEnded) return;
				stream.write(`${formatSshError(error)}\r\n`);
				prompt();
			});
	}

	async function runCommand(command: string) {
		const result = await executeTerminalCommand(terminal, command);
		if (!result) return;

		if (result.didClear) stream.write("\x1b[2J\x1b[H");
		writeTerminalOutput(stream, result.output);
		if (result.exitRequested) stream.end();
	}

	async function completeInput() {
		const suggestion = await autocomplete(input, terminal);
		if (!suggestion || suggestion === input) {
			ringBell();
			return;
		}

		resetHistoryAfterEdit();
		redrawInput(suggestion);
	}

	function showPreviousHistory() {
		if (terminal.history.length === 0) {
			ringBell();
			return;
		}

		if (historyCursor === terminal.history.length) historyDraft = input;
		if (historyCursor > 0) {
			historyCursor--;
			redrawInput(terminal.history[historyCursor]);
		} else {
			ringBell();
		}
	}

	function showNextHistory() {
		if (historyCursor >= terminal.history.length) {
			ringBell();
			return;
		}

		historyCursor++;
		redrawInput(
			historyCursor === terminal.history.length
				? historyDraft
				: terminal.history[historyCursor],
		);
		if (historyCursor === terminal.history.length) historyDraft = "";
	}

	stream.write("\r\n");
	stream.write(`IP: ${info.ip}\r\n`);
	stream.write(`Port: ${info.port}\r\n`);
	stream.write(`Ident: ${info.header.identRaw}\r\n`);
	stream.write("\r\n");
	stream.write("Type `help`.\r\n");
	prompt();

	stream.on("data", (chunk: Uint8Array) => {
		queueInput(chunk);
	});

	async function processInput(chunk: Uint8Array) {
		for (const byte of chunk) {
			if (await processEscapeByte(byte)) {
				continue;
			} else if (byte === 3) {
				input = "";
				resetHistoryCursor();
				stream.write("^C\r\n");
				prompt();
			} else if (byte === 4) {
				stream.end();
			} else if (byte === 9) {
				await completeInput();
			} else if (byte === 13 || byte === 10) {
				const command = input;
				input = "";
				escapeBuffer = [];
				stream.write("\r\n");
				try {
					await runCommand(command);
				} catch (error) {
					stream.write(`${formatSshError(error)}\r\n`);
				} finally {
					resetHistoryCursor();
					if (!stream.writableEnded) prompt();
				}
			} else if (byte === 127 || byte === 8) {
				if (input.length > 0) {
					resetHistoryAfterEdit();
					input = input.slice(0, -1);
					stream.write("\b \b");
				}
			} else if (byte >= 32) {
				resetHistoryAfterEdit();
				const char = String.fromCharCode(byte);
				input += char;
				stream.write(char);
			}
		}
	}

	async function processEscapeByte(byte: number) {
		if (escapeBuffer.length === 0 && byte !== 27) return false;

		escapeBuffer.push(byte);
		if (escapeBuffer.length === 1) return true;
		if (escapeBuffer.length === 2 && (byte === 0x5b || byte === 0x4f))
			return true;

		const finalByte = byte >= 0x40 && byte <= 0x7e;
		if (!finalByte) return true;

		const sequence = String.fromCharCode(...escapeBuffer);
		escapeBuffer = [];

		if (
			sequence === "\x1bOA" ||
			(sequence.startsWith("\x1b[") && sequence.endsWith("A"))
		) {
			showPreviousHistory();
		} else if (
			sequence === "\x1bOB" ||
			(sequence.startsWith("\x1b[") && sequence.endsWith("B"))
		) {
			showNextHistory();
		}

		return true;
	}
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
		console.warn("[ssh stream]", formatSshError(error));
	});
	stream.stderr.on("error", (error: unknown) => {
		console.warn("[ssh stderr]", formatSshError(error));
	});
}
