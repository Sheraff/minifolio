import { createResource, type Resource } from "solid-js";
import * as v from "valibot";

export function createServerResource<T>(
	endpoint: string,
	serverFn: false | Promise<() => Promise<unknown>>,
	schema: v.BaseSchema<any, T, any>,
) {
	const fetcher = serverFn
		? async () => v.parse(schema, await (await serverFn)())
		: async () => {
				const response = await fetch(endpoint);
				if (!response.ok) throw new Error(`Error fetching ${endpoint}`);
				return v.parse(schema, await response.json());
			};
	return () => createResource(fetcher)[0];
}


export type ServerResourceType<
	ServerResource
> = ServerResource extends () => Resource<infer Result>
	? Result
	: never