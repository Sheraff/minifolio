import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const host = "127.0.0.1";
const port = 5174;
const root = process.cwd();
const output = path.join(root, "public", "og.png");
const chrome = process.env.CHROME_BIN ?? "google-chrome";

await fs.mkdir(path.dirname(output), { recursive: true });

const server = await createServer({
	server: {
		host,
		port,
		strictPort: true,
	},
	logLevel: "warn",
});

try {
	await server.listen();

	await run(chrome, [
		"--headless=new",
		"--disable-gpu",
		"--no-sandbox",
		"--hide-scrollbars",
		"--force-device-scale-factor=1",
		"--window-size=1200,630",
		"--virtual-time-budget=1000",
		`--screenshot=${output}`,
		`http://${host}:${port}/og.html`,
	]);
} finally {
	await server.close();
}

function run(command: string, args: string[]) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { stdio: "inherit" });

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${command} exited with code ${code}`));
			}
		});
	});
}
