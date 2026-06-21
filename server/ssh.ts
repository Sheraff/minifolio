// server/toy-ssh.ts
import { readFileSync } from "node:fs";
import ssh from "ssh2";

const MAX_CONCURRENT = 10;

export function createSshServer() {
	let hostKey;
	try {
		hostKey = readFileSync(".ssh_host_ed25519_key");
	} catch {
		console.warn("[ssh] No ssh host key found.");
		hostKey = ssh.utils.generateKeyPairSync("ed25519").private;
	}

	let concurrent = 0;

	const server = new ssh.Server(
		{
			hostKeys: [hostKey],
			// TODO: make a cool multiline banner with some ascii art
			banner: "Hello from minifolio",
			keepaliveCountMax: 10,
		},
		(client, info) => {
			concurrent++;
			let username = "";

			client.on("error", (error) => {
				console.warn("[ssh]", formatSshError(error));
			});

			let closed = false;
			client.on("close", () => {
				if (closed) return;
				closed = true;
				concurrent--;
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
				const timeout = setTimeout(() => client.end(), 3000);
				timeout.unref();
				client.on("session", (accept, reject) => {
					clearTimeout(timeout);
					if (concurrent > MAX_CONCURRENT) {
						reject();
						return;
					}

					const session = accept();

					session.on("pty", simpleAccept);
					session.on("exec", acceptAndExit);
					session.on("subsystem", simpleReject);
					session.on("sftp", simpleReject);
					session.on("signal", simpleAccept);

					session.on("shell", (accept) => {
						const stream = accept();
						interactiveStream(username, info, stream);
					});
				});
			});
		},
	);

	server.on("error", (error: unknown) => {
		console.warn("[ssh]", formatSshError(error));
	});

	return server;
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
) {
	let input = "";

	function prompt() {
		stream.write(`\r\n${username}@minifolio:~$ `);
	}

	async function runCommand(command: string) {
		const trimmed = command.trim();

		if (!trimmed) return;
		if (trimmed === "help") {
			stream.write("\r\nhelp  portfolio  whoami  hostname  exit");
		} else if (trimmed === "whoami") {
			stream.write(`\r\n${username}`);
		} else if (trimmed === "hostname") {
			stream.write("\r\nminifolio");
		} else if (trimmed === "portfolio") {
			stream.write(
				"\r\nHi, I'm Florian. This is the SSH version of my portfolio terminal.",
			);
		} else if (trimmed === "exit" || trimmed === "logout") {
			stream.write("\r\nbye\r\n");
			stream.end();
		} else {
			stream.write(`\r\n${trimmed}: command not found`);
		}
	}

	stream.write("\r\n");
	stream.write(`IP: ${info.ip}\r\n`);
	stream.write(`Port: ${info.port}\r\n`);
	stream.write(`Ident: ${info.header.identRaw}\r\n`);
	stream.write("\r\n");
	stream.write("Type `help`.\r\n");
	prompt();

	stream.on("data", async (chunk: Uint8Array) => {
		for (const byte of chunk) {
			if (byte === 3) {
				input = "";
				stream.write("^C");
				prompt();
			} else if (byte === 4) {
				stream.end();
			} else if (byte === 13 || byte === 10) {
				const command = input;
				input = "";
				await runCommand(command);
				if (!stream.writableEnded) prompt();
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
	});
}
