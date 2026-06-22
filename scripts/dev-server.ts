import { spawn, type ChildProcess } from "node:child_process";
import { statSync, watch, type FSWatcher } from "node:fs";

const WATCH_PATHS = ["server", "vite.config.ts", "index.html"];
const RESTART_DEBOUNCE_MS = 100;
const FORCE_EXIT_MS = 5000;
const serverArgs =
	process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2);

let server: ChildProcess | undefined;
let restartTimer: NodeJS.Timeout | undefined;
let restarting = false;
let restartAgain = false;
let shuttingDown = false;

const watchers = WATCH_PATHS.map((path) => {
	const watcher = watch(
		path,
		{ recursive: statSync(path).isDirectory() },
		() => scheduleRestart(),
	);
	watcher.once("error", (cause) => {
		console.error(new Error(`Failed watching ${path}`, { cause }));
		void shutdown("SIGTERM");
	});
	return watcher;
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

startServer();

function startServer() {
	const child = spawn(
		process.execPath,
		["server/index.ts", "--dev", ...serverArgs],
		{
			stdio: "inherit",
			detached: true,
		},
	);

	server = child;
	child.once("error", (cause) => {
		if (server === child) server = undefined;
		console.error(new Error("Failed to start dev server", { cause }));
	});
	child.once("exit", (code, signal) => {
		if (server === child) server = undefined;
		if (shuttingDown || restarting) return;
		if (code === 0) return;
		console.error(
			`dev server exited with ${signal ? `signal ${signal}` : `code ${code}`}`,
		);
	});
}

function scheduleRestart() {
	if (shuttingDown) return;
	if (restartTimer) clearTimeout(restartTimer);
	restartTimer = setTimeout(() => void restart(), RESTART_DEBOUNCE_MS);
}

async function restart() {
	if (restarting) {
		restartAgain = true;
		return;
	}

	restarting = true;
	console.log("\nRestarting dev server...");
	await stopServer("SIGTERM");
	if (!shuttingDown) startServer();
	restarting = false;

	if (restartAgain) {
		restartAgain = false;
		scheduleRestart();
	}
}

async function shutdown(signal: NodeJS.Signals) {
	if (shuttingDown) {
		killProcessGroup(server, "SIGKILL");
		process.exit(1);
	}

	shuttingDown = true;
	if (restartTimer) clearTimeout(restartTimer);
	closeWatchers(watchers);
	await stopServer(signal);
	process.exit(0);
}

function stopServer(signal: NodeJS.Signals) {
	const child = server;
	if (!child?.pid || child.exitCode !== null) return Promise.resolve();

	return new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			killProcessGroup(child, "SIGKILL");
		}, FORCE_EXIT_MS);
		timeout.unref();

		child.once("exit", () => {
			clearTimeout(timeout);
			if (server === child) server = undefined;
			resolve();
		});

		killProcessGroup(child, signal);
	});
}

function closeWatchers(watchers: FSWatcher[]) {
	for (const watcher of watchers) watcher.close();
}

function killProcessGroup(
	child: ChildProcess | undefined,
	signal: NodeJS.Signals,
) {
	if (!child?.pid) return;
	try {
		process.kill(-child.pid, signal);
	} catch {
		try {
			child.kill(signal);
		} catch {
			// Process already exited.
		}
	}
}
