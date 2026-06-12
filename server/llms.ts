import type { HttpBindings } from '@hono/node-server'
import { Hono } from 'hono'
import { fetchTanstackArticles } from './articles.ts'
import { fetchGitHubContributions } from './github.ts'
import { fetchContributedRepositories } from './githubRepositories.ts'
import { fetchLabProjects, type LabProject } from './projects.ts'

const encoder = new TextEncoder()
const siteUrl = 'https://florianpellet.com'
const labsUrl = 'https://sheraff.github.io'
const githubUrl = 'https://github.com/sheraff'
const blueskyUrl = 'https://bsky.app/profile/sheraff.bsky.social'

type GitHubContributions = Awaited<ReturnType<typeof fetchGitHubContributions>>
type ContributedRepositories = Awaited<ReturnType<typeof fetchContributedRepositories>>
type TanstackArticles = Awaited<ReturnType<typeof fetchTanstackArticles>>

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatDescription(value: string | null) {
  if (!value) {
    return ''
  }

  const description = normalizeText(value)
  if (description.length === 0) {
    return ''
  }

  return /[.!?]$/.test(description) ? `: ${description}` : `: ${description}.`
}

function appendListSection(lines: string[], title: string, items: string[]) {
  if (items.length === 0) {
    return
  }

  lines.push('', title, ...items)
}

function buildIntroSection() {
  return [
    '# Florian Pellet',
    '',
    '> Personal website and portfolio for Florian Pellet, also known as @sheraff.',
    '',
    '## Identity',
    `- Website: ${siteUrl}`,
    '- Name: Florian Pellet',
    '- Handle: @sheraff',
    '- Email: me@florianpellet.com',
    `- GitHub: ${githubUrl}`,
    `- Bluesky: ${blueskyUrl}`,
    '',
    '## Guidance',
    '- This file is the machine-readable summary for the website.',
    '- Prefer the JSON endpoints below when you need structured data.',
    '',
    '## Machine-readable endpoints',
    `- ${siteUrl}/api/github/contributions`,
    `- ${siteUrl}/api/github/repositories`,
    `- ${siteUrl}/api/articles/tanstack`,
    `- ${siteUrl}/api/projects`,
  ].join('\n') + '\n'
}

function buildContributionsSection(contributions: GitHubContributions) {
  return `\n## GitHub activity\n- Contributions in the last year: ${contributions.total.lastYear}\n`
}

function buildRepositoriesSection(repositories: ContributedRepositories['repositories']) {
  const items = repositories
    .filter((repository) => repository.lastPullRequest)
    .slice(0, 16)
    .map((repository) => {
      const description = formatDescription(repository.description)
      return `- ${repository.nameWithOwner} (${repository.contributionCount} contributions, last active ${repository.lastContributedAt})${description} ${repository.url}`
    })

  const lines: string[] = []
  appendListSection(lines, '## Open source repositories', items)
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

function buildArticlesSection(articles: TanstackArticles['articles']) {
  const items = articles.map((article) =>
    `- ${article.title}. ${article.link}`,
  )

  const lines: string[] = []
  appendListSection(lines, '## Articles', items)
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

function buildProjectsSection(projects: LabProject[]) {
  const items = projects
    .filter((project) => project.image)
    .slice(0, 12)
    .map((project) => {
      const description = formatDescription(project.description)
      const tags = project.tags.length > 0 ? ` [tags: ${project.tags.join(', ')}]` : ''
      const url = new URL(project.url, labsUrl).toString()
      return `- ${project.title}${description}${tags}. ${url}`
    })

  const lines: string[] = []
  appendListSection(lines, '## Experiments', items)
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

type SectionResult = {
  key: string
  chunk: string
}

function createSectionPromise<T>(
  key: string,
  promise: Promise<T>,
  buildSection: (value: T) => string,
) {
  return promise
    .then((value): SectionResult => ({
      key,
      chunk: buildSection(value),
    }))
    .catch((error): SectionResult => {
      console.error(error)
      return { key, chunk: '' }
    })
}

async function streamLlmsTxt() {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(buildIntroSection()))

      const pending = new Map<string, Promise<SectionResult>>([
        ['contributions', createSectionPromise('contributions', fetchGitHubContributions(), buildContributionsSection)],
        ['repositories', createSectionPromise('repositories', fetchContributedRepositories(), ({ repositories }) => buildRepositoriesSection(repositories))],
        ['articles', createSectionPromise('articles', fetchTanstackArticles(), ({ articles }) => buildArticlesSection(articles))],
        ['projects', createSectionPromise('projects', fetchLabProjects(), buildProjectsSection)],
      ])

      while (pending.size > 0) {
        const { key, chunk } = await Promise.race(pending.values())
        pending.delete(key)

        if (chunk.length > 0) {
          controller.enqueue(encoder.encode(chunk))
        }
      }

      controller.close()
    },
    cancel() {
      return undefined
    },
  })

  return stream
}

export function registerLlmsRoute(app: Hono<{ Bindings: HttpBindings }>) {
  app.get('/llms.txt', async (c) => {
    c.header('Cache-Control', 'public, max-age=3600')
    c.header('Content-Type', 'text/plain; charset=UTF-8')

    return new Response(await streamLlmsTxt(), {
      headers: c.res.headers,
      status: 200,
    })
  })
}
