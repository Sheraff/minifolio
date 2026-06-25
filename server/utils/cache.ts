import { publicLog } from "#server/public-logs.ts";

const REFRESH_RETRY_MS = 5 * 60 * 1000;

type CachedValue<T> = {
	data: T;
	expiresAt: number;
};

export function createCachedFetcher<T>({
	label,
	ttlMs,
	fetch,
	onUpdate,
}: {
	label: string;
	ttlMs: number;
	fetch: () => Promise<T>;
	onUpdate?: (data: T, previous: T | undefined) => void;
}) {
	let cache: CachedValue<T> | undefined;
	let pending: Promise<T> | undefined;
	let refreshTimeout: NodeJS.Timeout | undefined;

	function scheduleRefresh(delayMs: number) {
		if (refreshTimeout) clearTimeout(refreshTimeout);
		refreshTimeout = setTimeout(() => {
			void load().catch((error) => {
				reportRefreshError(label, error);
				scheduleRefresh(REFRESH_RETRY_MS);
			});
		}, delayMs);
		refreshTimeout.unref();
	}

	async function refresh() {
		const previous = cache?.data;
		const data = await fetch();
		onUpdate?.(data, previous);
		cache = {
			data,
			expiresAt: Date.now() + ttlMs,
		};
		scheduleRefresh(ttlMs + 1);
		return data;
	}

	async function load(): Promise<T> {
		if (cache && cache.expiresAt > Date.now()) {
			return cache.data;
		}

		if (pending) {
			return pending;
		}

		const promise = refresh().catch((error) => {
			if (cache) {
				reportRefreshError(label, error);
				scheduleRefresh(REFRESH_RETRY_MS);
				return cache.data;
			}

			throw error;
		});

		pending = promise;
		try {
			return await promise;
		} finally {
			if (pending === promise) pending = undefined;
		}
	}

	return load;
}

function reportRefreshError(label: string, error: unknown) {
	publicLog(`[WARN] ${label} refresh failed`);
	console.warn(`[data] ${label} refresh failed`, error);
}
