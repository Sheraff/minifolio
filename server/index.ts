import * as v from "valibot";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { publicLog } from "./public-logs.ts";
import { registerClose, registerShutdownManager } from "./utils/shutdown.ts";

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
	},
});

const isDev = parsed.values.dev === true;
const portSchema = v.pipe(v.string(), v.toNumber(), v.number(), v.integer());

registerShutdownManager(isDev);

const webPort = v.safeParse(portSchema, parsed.values.port ?? process.env.PORT);
if (webPort.success) {
	const port = webPort.output;
	const { createWebServer } = await import("./web.ts");
	const serverDir = fileURLToPath(new URL(".", import.meta.url));
	const server = await createWebServer(isDev, serverDir);
	if (server) {
		server.listen(port, () => {
			console.log(`http://localhost:${port}`);
		});
		registerClose(server, "http server");
		publicLog("[root] http server started");
	}
}

const fingerPort = v.safeParse(portSchema, parsed.values.finger);
if (fingerPort.success) {
	const port = fingerPort.output;
	const { createFingerServer } = await import("./finger.ts");
	const server = createFingerServer();
	if (server) {
		server.listen(port, () => {
			console.log(`Finger server listening on :${port}`);
		});
		registerClose(server, "finger server");
		publicLog("[root] finger server started");
	}
}

const sshPort = v.safeParse(portSchema, parsed.values.ssh);
if (sshPort.success) {
	const port = sshPort.output;
	const { createSshServer } = await import("./ssh.ts");
	const server = createSshServer(isDev);
	if (server) {
		server.listen(port, () => {
			console.log(`SSH server listening on :${port}`);
		});
		registerClose(server, "ssh server");
		publicLog("[root] ssh server started");
	}
}
