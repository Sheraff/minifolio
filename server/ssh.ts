// server/toy-ssh.ts
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ssh from "ssh2";
import {
	createTerminalSession,
	executeTerminalCommand,
} from "#client/sections/identity/terminal-core.ts";

const MAX_CONCURRENT = 10;
const AUTH_TIMEOUT_MS = 10_000;
const SESSION_TIMEOUT_MS = 3_000;
const HOST_KEY_PATH = ".ssh_host_ed25519_key";
const TERMINAL_FILES_ROOT = "fs";
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
				client.once("close", () => clearTimeout(sessionTimeout));
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
						const stream = accept();
						interactiveStream(username, info, stream, terminalFiles);
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
) {
	handleStreamError(stream);
	const terminal = createTerminalSession({
		files: { ...terminalFiles },
		allowedUrlPrefixes: SSH_ALLOWED_URL_PREFIXES,
		exitCommand: {
			message: "bye",
			requestExit: true,
		},
	});
	let input = "";
	let pending = Promise.resolve();

	function prompt() {
		stream.write(`${username}@minifolio:~$ `);
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
			if (byte === 3) {
				input = "";
				stream.write("^C\r\n");
				prompt();
			} else if (byte === 4) {
				stream.end();
			} else if (byte === 13 || byte === 10) {
				const command = input;
				input = "";
				stream.write("\r\n");
				try {
					await runCommand(command);
				} catch (error) {
					stream.write(`${formatSshError(error)}\r\n`);
				} finally {
					if (!stream.writableEnded) prompt();
				}
			} else if (byte === 127 || byte === 8) {
				if (input.length > 0) {
					input = input.slice(0, -1);
					stream.write("\b \b");
				}
			} else if (byte >= 32) {
				const char = String.fromCharCode(byte);
				input += char;
				stream.write(char);
			}
		}
	}
}

function writeTerminalOutput(stream: ssh.ServerChannel, output: string) {
	if (!output) return;
	stream.write(`${output.replace(/\n/g, "\r\n")}\r\n`);
}

function readTerminalFiles(root: string) {
	const files: Record<string, string> = {};
	walkTerminalFiles(root, root, files);
	return files;
}

function walkTerminalFiles(root: string, directory: string, files: Record<string, string>) {
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
