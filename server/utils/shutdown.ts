import { publicLog } from "#server/public-logs.ts";

let shuttingDown = false;
export type ShutdownContext = {
	signal: NodeJS.Signals;
	deadline: AbortSignal;
	childrenClosed: Promise<void>;
};
export type ShutdownResource = {
	close: (ctx: ShutdownContext) => void | Promise<void>;
	force?: (ctx: ShutdownContext) => void | Promise<void>;
};

export class ShutdownScope {
	#children = new Set<ShutdownScope>();
	#closing = false;
	#closed = false;
	#closeContext: ShutdownContext | undefined;
	#closePromise: Promise<void> | undefined;
	#parent: ShutdownScope | undefined;
	readonly name: string;
	readonly resource: ShutdownResource | undefined;

	constructor(
		name: string,
		resource?: ShutdownResource,
		parent?: ShutdownScope,
	) {
		this.name = name;
		this.resource = resource;
		this.#parent = parent;
		if (parent) parent.#children.add(this);
	}

	child(name: string, resource?: ShutdownResource) {
		const child = new ShutdownScope(name, resource, this);
		if (this.#closeContext) void child.close(this.#closeContext);
		return child;
	}

	get closing() {
		return this.#closing;
	}

	get closed() {
		return this.#closed;
	}

	unregister() {
		if (this.#parent) this.#parent.#children.delete(this);
		this.#parent = undefined;
	}

	close(ctx: ShutdownContext) {
		this.#closing = true;
		this.#closeContext ??= ctx;
		this.#closePromise ??= this.#close(ctx);
		return this.#closePromise;
	}

	async force(ctx: ShutdownContext) {
		await Promise.allSettled(
			Array.from(this.#children).map((child) => child.force(ctx)),
		);

		if (!this.resource?.force) return;
		console.log(`force closing ${this.name}`);
		try {
			await this.resource.force(ctx);
		} catch (cause) {
			console.error(
				new Error(`Error force closing ${this.name}`, { cause }),
			);
		}
	}

	async #close(ctx: ShutdownContext) {
		const childrenClosed = Promise.withResolvers<void>();
		const ownClose = this.#closeOwn({
			...ctx,
			childrenClosed: childrenClosed.promise,
		});
		void this.#closeChildren(ctx).then(childrenClosed.resolve);
		const childrenClose = this.#closeChildren(ctx, ownClose);

		const [ownResult] = await Promise.allSettled([ownClose, childrenClose]);
		if (
			this.resource &&
			ownResult.status === "fulfilled" &&
			ownResult.value
		) {
			console.log(`${this.name} closed successfully`);
		}
		this.#closed = true;
		this.unregister();
	}

	async #closeChildren(ctx: ShutdownContext, ownClose?: Promise<boolean>) {
		let ownClosed = !ownClose;
		if (ownClose) {
			void ownClose.finally(() => {
				ownClosed = true;
			});
		}

		let children = Array.from(this.#children).filter(
			(child) => !child.closed,
		);
		while (children.length > 0 || !ownClosed) {
			if (children.length === 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
				children = Array.from(this.#children).filter(
					(child) => !child.closed,
				);
				continue;
			}

			await Promise.allSettled(children.map((child) => child.close(ctx)));
			children = Array.from(this.#children).filter((child) => !child.closed);
		}
	}

	async #closeOwn(ctx: ShutdownContext) {
		if (!this.resource) return false;

		console.log(`closing ${this.name}`);
		try {
			await this.resource.close(ctx);
			return true;
		} catch (cause) {
			console.error(new Error(`Error closing ${this.name}`, { cause }));
			return false;
		}
	}
}

export function registerShutdownManager() {
	const root = new ShutdownScope("root");
	process.once("SIGTERM", shutdown);
	process.once("SIGINT", shutdown);
	return root;

	async function shutdown(signal: NodeJS.Signals) {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`\n${signal} received`);
		publicLog(`[root] shutdown received ${signal}`);

		const deadline = new AbortController();
		const context: ShutdownContext = {
			signal,
			deadline: deadline.signal,
			childrenClosed: Promise.resolve(),
		};
		const timeout = setTimeout(() => {
			deadline.abort();
			console.error("timed out waiting for servers to close\n");
			void root.force(context).finally(() => process.exit(1));
		}, 3000);
		timeout.unref();

		console.log("closing servers");
		await root.close(context);
		if (deadline.signal.aborted) return;

		console.log("shutting down\n");
		clearTimeout(timeout);
		process.exit(0);
	}
}

export function promiseClose(server: {
	close: (cb: (error?: Error) => void) => unknown;
}) {
	return new Promise<void>((resolve, reject) => {
		server.close((error?: Error & { code?: string }) => {
			if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}
