import { flushPublicLogs, publicLog } from "#server/public-logs.ts";

const nameKey = Symbol();
let shuttingDown = false;
type Closable = {
	close: (cb: (error?: unknown) => void) => void | Promise<void> | object;
};
const closables: (Closable & { [nameKey]: string })[] = [];

export function registerClose(closable: Closable, name: string) {
	closables.push(Object.assign(closable, { [nameKey]: name }));
}

export function isShuttingDown() {
	return shuttingDown;
}

export function registerShutdownManager(isDev: boolean) {
	process.once("SIGTERM", shutdown);
	process.once("SIGINT", shutdown);

	async function shutdown(signal: NodeJS.Signals) {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`\n${signal} received`);

		if (!isDev) {
			console.log("flushing logs");
			publicLog(`[root] shutdown received ${signal}`);
			await flushPublicLogs();
		}

		const timeout = setTimeout(() => {
			console.error("timed out waiting for servers to close\n");
			process.exit(1);
		}, 3000);
		timeout.unref();

		console.log("closing servers");
		await Promise.allSettled(
			closables.map((c) => {
				const name = c[nameKey];
				console.log(`closing ${name}`);
				return new Promise<void>((resolve, reject) => {
					const result = c.close((error) => {
						if (error) {
							console.error(
								new Error(`Error closing ${name}`, { cause: error }),
							);
							reject(error);
						} else {
							console.log(`${name} closed successfully`);
							resolve();
						}
					});
					if (result && result instanceof Promise)
						result.then(resolve, reject);
				});
			}),
		);

		console.log("shutting down\n");
		clearTimeout(timeout);
		process.exit(0);
	}
}
