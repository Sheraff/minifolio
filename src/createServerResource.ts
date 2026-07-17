import { createContext, createResource, type Resource, useContext } from "solid-js";
import * as v from "valibot";

export type ServerResourceData = Record<string, unknown>;

export const ServerResourceContext = createContext<ServerResourceData>();

export function createServerResource<T>(
	endpoint: string,
	schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
) {
	return () => {
		const serverData = useContext(ServerResourceContext);
		const fetcher = import.meta.env.SSR
			? async () => {
				if (!serverData || !(endpoint in serverData)) {
					throw new Error(`Missing server resource: ${endpoint}`);
				}
				return v.parse(schema, serverData[endpoint]);
			}
			: async () => {
				const response = await fetch(endpoint);
				if (!response.ok) throw new Error(`Error fetching ${endpoint}`);
				return v.parse(schema, await response.json());
			};
		return createResource(fetcher)[0];
	};
}

export type ServerResourceType<
	ServerResource
> = ServerResource extends () => Resource<infer Result>
	? Result
	: never
