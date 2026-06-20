import { fileURLToPath } from 'node:url'
import {
  createAdaptorServer,
  type HttpBindings,
} from '@hono/node-server'
import { Hono } from 'hono'
import { fetchTanstackArticles } from './articles.ts'
import { fetchGitHubContributions } from './github.ts'
import { fetchContributedRepositories } from './githubRepositories.ts'
import { registerLlmsRoute } from './llms.ts'
import { fetchLabProjects } from './projects.ts'
import { parseArgs } from "node:util"
import { client, devClient } from './client.ts'

const parsed = parseArgs({
  options: {
    dev: {
      type: 'boolean',
      default: false,
    },
    port: {
      type: 'string',
    },
    finger: {
      type: 'string',
    }
  }
})

const isDev = parsed.values.dev
const port = Number(parsed.values.port ?? process.env.PORT ?? 5743)
const fingerPort = !!parsed.values.finger && Number(parsed.values.finger)

const serverDir = fileURLToPath(new URL('.', import.meta.url))

const app = new Hono<{ Bindings: HttpBindings }>()

registerLlmsRoute(app)

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/projects', async (c) => {
  try {
    const projects = await fetchLabProjects()
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400, stale-if-error=86400')
    return c.json(projects)
  } catch (error) {
    console.error(error)
    c.header('Cache-Control', 'no-store')
    return c.json({ error: 'Unable to load projects' }, 502)
  }
})

app.get('/api/github/contributions', async (c) => {
  try {
    c.header('Cache-Control', 'public, max-age=3600')
    return c.json(await fetchGitHubContributions())
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load GitHub contributions' }, 502)
  }
})

app.get('/api/github/repositories', async (c) => {
  try {
    c.header('Cache-Control', 'public, max-age=3600')
    return c.json(await fetchContributedRepositories())
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load contributed GitHub repositories' }, 502)
  }
})

app.get('/api/articles/tanstack', async (c) => {
  try {
    c.header('Cache-Control', 'public, max-age=3600')
    return c.json(await fetchTanstackArticles())
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load TanStack articles' }, 502)
  }
})

const server = createAdaptorServer({ fetch: app.fetch })

if (isDev) {
  app.use('*', await devClient(server))
} else {
	app.route('/', client(serverDir))
}

server.listen(port, () => {
  console.log(`http://localhost:${port}`)
})

if (fingerPort) {
  const { createFingerServer } = await import('./finger.ts')
  const fingerServer = createFingerServer()
  fingerServer.listen(fingerPort, () => {
    console.log(`Finger server listening on port ${fingerPort}`)
  })
}
