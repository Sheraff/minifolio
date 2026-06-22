import { flushPublicLogs, publicLog } from "#server/public-logs.ts";

const names = new WeakMap<Closable, string>();
let shuttingDown = false;
type Closable = {
	close: (cb?: (error?: unknown) => void) => void | Promise<unknown> | object;
};
const closables = new Set<Closable>();

export function registerClose(closable: Closable, name: string) {
	closables.add(closable);
	names.set(closable, name);
}

export function unregisterClose(closable: Closable) {
	closables.delete(closable);
	names.delete(closable);
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
			Array.from(closables).map((c) => {
				const name = names.get(c);
				console.log(`closing ${name}`);
				return new Promise<void>((resolve, reject) => {
					const onError = (cause: unknown) => {
						console.error(new Error(`Error closing ${name}`, { cause }));
						reject(cause);
					};
					const onSuccess = () => {
						console.log(`${name} closed successfully`);
						resolve();
					};
					const result = c.close((error) => {
						if (error) onError(error);
						else onSuccess();
					});
					if (result && result instanceof Promise)
						result.then(onSuccess, onError);
				});
			}),
		);

		console.log("shutting down\n");
		clearTimeout(timeout);
		process.exit(0);
	}
}
