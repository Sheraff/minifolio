import * as v from "valibot";
import { parseArgs } from "node:util";

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

const portSchema = v.pipe(v.string(), v.toNumber(), v.number(), v.integer());

const webPort = v.safeParse(portSchema, parsed.values.port ?? process.env.PORT);
if (webPort.success) {
	const port = webPort.output;
	const isDev = parsed.values.dev;
	const { createWebServer } = await import("./web.ts");
	const server = await createWebServer(isDev);
	server.listen(port, () => {
		console.log(`http://localhost:${port}`);
	});
}

const fingerPort = v.safeParse(portSchema, parsed.values.finger);
if (fingerPort.success) {
	const port = fingerPort.output;
	const { createFingerServer } = await import("./finger.ts");
	const server = createFingerServer();
	server.listen(port, () => {
		console.log(`Finger server listening on :${port}`);
	});
}

const sshPort = v.safeParse(portSchema, parsed.values.ssh);
if (sshPort.success) {
	const port = sshPort.output;
	const { createSshServer } = await import("./ssh.ts");
	const server = createSshServer();
	if (server) {
		server.listen(port, () => {
			console.log(`SSH server listening on :${port}`);
		});
	}
}
