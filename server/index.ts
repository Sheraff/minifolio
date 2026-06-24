import * as v from "valibot";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { publicLog } from "./public-logs.ts";
import { registerShutdownManager } from "./utils/shutdown.ts";

const parsed = parseArgs({
	options: {
		dev: {
			type: "boolean",
			default: false,
		},
		port: {
			type: "string",
		},
		finger: {
			type: "string",
		},
		ssh: {
			type: "string",
		},
		git: {
			type: "string",
		},
	},
});

const isDev = parsed.values.dev === true;
const portSchema = v.pipe(v.string(), v.toNumber(), v.number(), v.integer());

const shutdownRoot = registerShutdownManager();

const webPort = v.safeParse(portSchema, parsed.values.port ?? process.env.PORT);
if (webPort.success) {
	const port = webPort.output;
	const { createWebServer } = await import("./web.ts");
	const serverDir = fileURLToPath(new URL(".", import.meta.url));
	const server = await createWebServer(isDev, serverDir, shutdownRoot);
	if (server) {
		server.listen(port, () => {
			console.log(`http://localhost:${port}`);
		});
		publicLog("[root] http server started");
	}
}

const fingerPort = v.safeParse(portSchema, parsed.values.finger);
if (fingerPort.success) {
	const port = fingerPort.output;
	const { createFingerServer } = await import("./finger.ts");
	const server = createFingerServer(shutdownRoot);
	if (server) {
		server.listen(port, () => {
			console.log(`Finger server listening on :${port}`);
		});
		publicLog("[root] finger server started");
	}
}

const sshPort = v.safeParse(portSchema, parsed.values.ssh);
if (sshPort.success) {
	const port = sshPort.output;
	const { createSshServer } = await import("./ssh.ts");
	const server = createSshServer(isDev, shutdownRoot);
	if (server) {
		server.listen(port, () => {
			console.log(`SSH server listening on :${port}`);
		});
		publicLog("[root] ssh server started");
	}
}

const gitPort = v.safeParse(portSchema, parsed.values.git);
if (gitPort.success) {
	const port = gitPort.output;
	const { createGitServer } = await import("./git.ts");
	const server = createGitServer(shutdownRoot);
	if (server) {
		server.listen(port, () => {
			console.log(`Git server listening on :${port}`);
		});
		publicLog("[root] git server started");
	}
}
