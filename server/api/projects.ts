import { publicLog } from "#server/public-logs.ts"

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
  if (!Array.isArray(value)) {
    throw new Error('Projects response did not contain an array')
  }

  return value.flatMap((project) => {
    if (!project || typeof project !== 'object') {
      return []
    }

    const entry = project as Record<string, unknown>
    const rawGit = entry.git

    if (
      typeof entry.route !== 'string'
      || typeof entry.url !== 'string'
      || typeof entry.title !== 'string'
      || !rawGit
      || typeof rawGit !== 'object'
    ) {
      return []
    }

    const git = rawGit as Record<string, unknown>
    if (
      typeof git.lastModified !== 'number'
      || typeof git.firstAdded !== 'number'
    ) {
      return []
    }

    return [{
      route: entry.route,
      url: entry.url,
      title: entry.title,
      description: typeof entry.description === 'string' ? entry.description : null,
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      image: typeof entry.image === 'string' ? entry.image : null,
      git: {
        lastModified: git.lastModified,
        firstAdded: git.firstAdded,
      },
    }]
  })
}
