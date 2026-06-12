const projectsUrl = 'https://sheraff.github.io/vite-labs/projects.json'

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

export async function fetchLabProjects(): Promise<LabProject[]> {
  const response = await fetch(projectsUrl)

  if (!response.ok) {
    throw new Error(`Projects request failed with ${response.status}`)
  }

  return readLabProjects(await response.json())
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
