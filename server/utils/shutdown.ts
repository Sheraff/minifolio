import { publicLog } from "#server/public-logs.ts";

let shuttingDown = false;
export type ShutdownContext = {
	deadline: AbortSignal;
	childrenClosed: Promise<void>;
};
export type ShutdownResource = {
	close?: (ctx: ShutdownContext) => unknown;
	force?: (ctx: ShutdownContext) => unknown;
};

export class ShutdownScope {
	#children = new Set<ShutdownScope>();
	#closing = false;
	#isClosed = false;
	#closed = Promise.withResolvers<void>();
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
		return this.#isClosed;
	}

	unregister() {
		if (this.#isClosed) return;
		this.#isClosed = true;
		if (this.#parent) this.#parent.#children.delete(this);
		this.#parent = undefined;
		this.#closed.resolve();
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
			watchAsyncError(
				this.resource.force(ctx),
				`Error force closing ${this.name}`,
			);
		} catch (cause) {
			console.error(
				new Error(`Error force closing ${this.name}`, { cause }),
			);
		}
	}

	async #close(ctx: ShutdownContext) {
		const childrenClosed = Promise.withResolvers<void>();
		const closeRequested = this.#requestClose({
			...ctx,
			childrenClosed: childrenClosed.promise,
		});
		const childrenClose = this.#closeChildren(ctx);
		void childrenClose.then(childrenClosed.resolve, childrenClosed.reject);

		await childrenClose;
		if (!this.resource) this.unregister();
		await this.#closed.promise;
		if (this.resource && closeRequested) {
			console.log(`${this.name} closed successfully`);
		}
	}

	async #closeChildren(ctx: ShutdownContext) {
		let children = Array.from(this.#children).filter(
			(child) => !child.closed,
		);
		while (children.length > 0) {
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

	#requestClose(ctx: ShutdownContext) {
		if (!this.resource) return false;

		console.log(`closing ${this.name}`);
		try {
			watchAsyncError(
				this.resource.close?.(ctx),
				`Error closing ${this.name}`,
			);
			return true;
		} catch (cause) {
			console.error(new Error(`Error closing ${this.name}`, { cause }));
			return false;
		}
	}
}

function watchAsyncError(result: unknown, message: string) {
	if (!result || typeof (result as PromiseLike<unknown>).then !== "function") {
		return;
	}

	void Promise.resolve(result).catch((cause) => {
		console.error(new Error(message, { cause }));
	});
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
