import * as v from 'valibot'

export class GitHubResourceLimitError extends Error {
	constructor() {
		super('Resource limits for this query exceeded.')
		this.name = 'GitHubResourceLimitError'
	}
}

const graphQLErrorSchema = v.object({
	type: v.optional(v.string()),
	message: v.string(),
})

const graphQLEnvelopeSchema = v.object({
	errors: v.optional(v.array(graphQLErrorSchema)),
})

export function parseGraphQLResponse<T>(
	schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
	input: unknown,
) {
	const { errors } = v.parse(graphQLEnvelopeSchema, input)
	const resourceLimit = errors?.find((error) =>
		error.type === 'RESOURCE_LIMITS_EXCEEDED'
		|| error.message === 'Resource limits for this query exceeded.'
	)
	if (resourceLimit) throw new GitHubResourceLimitError()
	if (errors?.[0]) throw new Error(errors[0].message)
	return v.parse(schema, input)
}
