import { Hono } from "hono"
import { fetchTanstackArticles } from './articles.ts'
import { fetchGitHubContributions } from './github.ts'
import { fetchContributedRepositories } from './githubRepositories.ts'
import { fetchLabProjects } from './projects.ts'

export function api() {
	const app = new Hono()

	app.get('/health', (c) => c.json({ ok: true }))
	
	app.get('/projects', async (c) => {
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
	
	app.get('/github/contributions', async (c) => {
	  try {
	    c.header('Cache-Control', 'public, max-age=3600')
	    return c.json(await fetchGitHubContributions())
	  } catch (error) {
	    console.error(error)
	    return c.json({ error: 'Unable to load GitHub contributions' }, 502)
	  }
	})
	
	app.get('/github/repositories', async (c) => {
	  try {
	    c.header('Cache-Control', 'public, max-age=3600')
	    return c.json(await fetchContributedRepositories())
	  } catch (error) {
	    console.error(error)
	    return c.json({ error: 'Unable to load contributed GitHub repositories' }, 502)
	  }
	})
	
	app.get('/articles/tanstack', async (c) => {
	  try {
	    c.header('Cache-Control', 'public, max-age=3600')
	    return c.json(await fetchTanstackArticles())
	  } catch (error) {
	    console.error(error)
	    return c.json({ error: 'Unable to load TanStack articles' }, 502)
	  }
	})

	return app
}