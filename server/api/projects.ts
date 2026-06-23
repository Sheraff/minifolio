import { publicLog } from "#server/public-logs.ts"
import * as v from 'valibot'

const projectsUrl = 'https://sheraff.github.io/vite-labs/projects.json'
const ONE_HOUR_MS = 60 * 60 * 1000

export type LabProject = {
  route: string
  url: string
  title: string
  description: string | null
  tags: string[]
  image: string | null
  git: {
    lastModified: number
    firstAdded: number
  }
}

const optionalNullableStringSchema = v.optional(
  v.fallback(v.nullable(v.string()), null),
  null,
)

const stringArraySchema = v.pipe(
  v.array(v.fallback(v.optional(v.string()), undefined)),
  v.transform((items) => items.filter((item): item is string => item !== undefined)),
)

const labProjectTagsSchema = v.optional(v.fallback(stringArraySchema, []), [])

const labProjectSchema = v.object({
  route: v.string(),
  url: v.string(),
  title: v.string(),
  description: optionalNullableStringSchema,
  tags: labProjectTagsSchema,
  image: optionalNullableStringSchema,
  git: v.object({
    lastModified: v.number(),
    firstAdded: v.number(),
  }),
})

const labProjectsResponseSchema = v.pipe(
  v.array(v.fallback(v.optional(labProjectSchema), undefined)),
  v.transform((projects) => projects.filter((project): project is LabProject => project !== undefined)),
)

let projectsCache:
  | {
    data: LabProject[]
    expiresAt: number
  }
  | undefined

let projectsPromise: Promise<LabProject[]> | undefined
let refreshTimeout: NodeJS.Timeout | undefined

async function loadLabProjects(): Promise<LabProject[]> {
  if (projectsCache && projectsCache.expiresAt > Date.now()) {
    return projectsCache.data
  }

  if (projectsPromise) {
    return projectsPromise
  }

  projectsPromise = fetchLabProjectsFromApi()

  try {
    const data = await projectsPromise
    const prevCount = projectsCache?.data.length
    if (prevCount !== undefined && prevCount < data.length) {
      publicLog("[data] new code experiment")
    }
    projectsCache = {
      data,
      expiresAt: Date.now() + ONE_HOUR_MS,
    }
    if (refreshTimeout) clearTimeout(refreshTimeout)
    refreshTimeout = setTimeout(loadLabProjects, ONE_HOUR_MS + 1)
    refreshTimeout.unref()
    return data
  } finally {
    projectsPromise = undefined
  }
}

async function fetchLabProjectsFromApi(): Promise<LabProject[]> {
  publicLog("[data] fetching code experiments")
  const response = await fetch(projectsUrl)

  if (!response.ok) {
    throw new Error(`Projects request failed with ${response.status}`)
  }

  return readLabProjects(await response.json())
}

export async function fetchLabProjects(): Promise<LabProject[]> {
  return loadLabProjects()
}

function readLabProjects(value: unknown): LabProject[] {
  return v.parse(labProjectsResponseSchema, value)
}
