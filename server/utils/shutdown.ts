import { publicLog } from "#server/public-logs.ts";
import { styleText } from "node:util";

let shuttingDown = false;
export type ShutdownContext = {
	deadline: AbortSignal;
	childrenClosed: Promise<void>;
};
export type ShutdownResource = {
	close?: (ctx: ShutdownContext) => unknown;
	force?: (ctx: ShutdownContext) => unknown;
};

type ShutdownScopeObserver = {
	childAdded?: (parent: ShutdownScope, child: ShutdownScope) => void;
	closeStarted?: (scope: ShutdownScope) => void;
	resourceClosed?: (scope: ShutdownScope) => void;
	closeFinished?: (scope: ShutdownScope) => void;
	forceStarted?: (scope: ShutdownScope) => void;
};

export class ShutdownScope {
	#children = new Set<ShutdownScope>();
	#closing = false;
	#isClosed = false;
	#closed = Promise.withResolvers<void>();
	#closeContext: ShutdownContext | undefined;
	#closePromise: Promise<void> | undefined;
	#parent: ShutdownScope | undefined;
	#observer: ShutdownScopeObserver | undefined;
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
		this.#observer = parent ? parent.#observer : undefined;
		if (parent) {
			parent.#children.add(this);
			this.#observer?.childAdded?.(parent, this);
		}
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

	done() {
		if (this.#isClosed) return;
		this.#observer?.resourceClosed?.(this);
		this.#isClosed = true;
		if (this.#parent) this.#parent.#children.delete(this);
		this.#parent = undefined;
		this.#closed.resolve();
	}

	close(ctx: ShutdownContext) {
		if (!this.#closing) this.#observer?.closeStarted?.(this);
		this.#closing = true;
		this.#closeContext ??= ctx;
		this.#closePromise ??= this.#close(ctx);
		return this.#closePromise;
	}

	async force(ctx: ShutdownContext) {
		if (this.resource?.force) this.#observer?.forceStarted?.(this);

		await Promise.allSettled(
			Array.from(this.#children).map((child) => child.force(ctx)),
		);

		if (!this.resource?.force) return;
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
		this.#requestClose({
			...ctx,
			childrenClosed: childrenClosed.promise,
		});
		const childrenClose = this.#closeChildren(ctx);
		void childrenClose.then(childrenClosed.resolve, childrenClosed.reject);

		await childrenClose;
		if (!this.resource) this.done();
		await this.#closed.promise;
		this.#observer?.closeFinished?.(this);
	}

	async #closeChildren(ctx: ShutdownContext) {
		let children = Array.from(this.#children).filter(
			(child) => !child.closed,
		);
		while (children.length > 0) {
			await Promise.allSettled(children.map((child) => child.close(ctx)));
			children = Array.from(this.#children).filter((child) => !child.closed);
		}
	}

	#requestClose(ctx: ShutdownContext) {
		if (!this.resource) return false;

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

	observe(observer: ShutdownScopeObserver) {
		this.#observer = observer;
		for (const child of Array.from(this.#children)) {
			observer.childAdded?.(this, child);
			child.observe(observer);
		}
	}
}

type ShutdownTreeNode = {
	scope: ShutdownScope;
	children: ShutdownTreeNode[];
	closeStartedAt?: number;
	resourceClosedAt?: number;
	closedAt?: number;
	forceStartedAt?: number;
	timedOutAt?: number;
};

class ShutdownTreeRenderer {
	#nodes = new Map<ShutdownScope, ShutdownTreeNode>();
	#root: ShutdownTreeNode;

	constructor(root: ShutdownScope) {
		this.#root = this.#node(root);
		root.observe({
			childAdded: (parent, child) => this.#childAdded(parent, child),
			closeStarted: (scope) => {
				this.#node(scope).closeStartedAt ??= Date.now();
			},
			resourceClosed: (scope) => {
				this.#node(scope).resourceClosedAt ??= Date.now();
			},
			closeFinished: (scope) => {
				this.#node(scope).closedAt ??= Date.now();
			},
			forceStarted: (scope) => {
				this.#node(scope).forceStartedAt ??= Date.now();
			},
		});
	}

	timedOut() {
		const now = Date.now();
		for (const node of this.#nodes.values()) {
			if (!this.#treeClosedAt(node)) node.timedOutAt ??= now;
		}
	}

	render() {
		return this.#renderNode(this.#root).join("\n");
	}

	#childAdded(parent: ShutdownScope, child: ShutdownScope) {
		const parentNode = this.#node(parent);
		const childNode = this.#node(child);
		if (!parentNode.children.includes(childNode)) {
			parentNode.children.push(childNode);
		}
	}

	#node(scope: ShutdownScope): ShutdownTreeNode {
		let node = this.#nodes.get(scope);
		if (!node) {
			node = { scope, children: [] };
			this.#nodes.set(scope, node);
		}
		return node;
	}

	#renderNode(
		node: ShutdownTreeNode,
		prefix = "",
		isLast = true,
		isRoot = true,
	): string[] {
		const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";
		const status = this.#status(node);
		const struct = styleText("white", `${prefix}${connector}`);
		const service = styleText(
			status.startsWith("closed") ? "green" : "red",
			node.scope.name,
		);
		const tag = styleText("dim", `[${status}]`);
		const line = `${struct}${service} ${tag}`;
		const childPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");
		const lines = [line];

		for (let i = 0; i < node.children.length; i++) {
			lines.push(
				...this.#renderNode(
					node.children[i],
					childPrefix,
					i === node.children.length - 1,
					false,
				),
			);
		}

		return lines;
	}

	#status(node: ShutdownTreeNode) {
		const closedAt = this.#treeClosedAt(node);
		if (closedAt) {
			return `closed${formatDuration(node.closeStartedAt, closedAt)}`;
		}

		if (node.resourceClosedAt) return "resource closed, waiting children";
		if (node.forceStartedAt) return "forcing";
		if (node.timedOutAt) return "timed out";
		if (node.closeStartedAt) return "closing";
		return "open";
	}

	#treeClosedAt(node: ShutdownTreeNode): number | undefined {
		if (node.closedAt) return node.closedAt;
		if (!node.resourceClosedAt) return undefined;

		let closedAt = node.resourceClosedAt;
		for (const child of node.children) {
			const childClosedAt = this.#treeClosedAt(child);
			if (!childClosedAt) return undefined;
			if (childClosedAt > closedAt) closedAt = childClosedAt;
		}

		return closedAt;
	}
}

function formatDuration(startedAt: number | undefined, endedAt: number) {
	if (startedAt === undefined) return "";
	return ` ${Math.max(0, endedAt - startedAt)}ms`;
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
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
	return root;

	async function shutdown(signal: NodeJS.Signals) {
		if (shuttingDown) return;
		shuttingDown = true;
		const renderer = new ShutdownTreeRenderer(root);
		console.log(`\n${signal} received\n`);
		publicLog(`[root] shutdown received ${signal}`);

		const deadline = new AbortController();
		const context: ShutdownContext = {
			deadline: deadline.signal,
			childrenClosed: Promise.resolve(),
		};
		const timeout = setTimeout(() => {
			deadline.abort();
			renderer.timedOut();
			console.error("timed out waiting for servers to close");
			void root.force(context).finally(() => {
				console.error(renderer.render());
				process.exit(1);
			});
		}, 3000);

		await root.close(context);
		if (deadline.signal.aborted) return;

		console.log(renderer.render());
		console.log("\nshutting down\n");
		clearTimeout(timeout);
		process.exit(0);
	}
}
