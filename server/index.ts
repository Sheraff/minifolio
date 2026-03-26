import type { Server as HttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAdaptorServer,
  type HttpBindings,
} from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response'
import { Hono } from 'hono'
import type { ViteDevServer } from 'vite'
import { hello } from "./hello.ts"

const isDev = process.argv.includes('--dev')
const port = Number(process.env.PORT ?? 5743)

const serverDir = fileURLToPath(new URL('.', import.meta.url))
const clientDistDir = isDev
  ? resolve(serverDir, '../dist/client')
  : resolve(serverDir, '../client')

const app = new Hono<{ Bindings: HttpBindings }>()

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/hello', (c) => {
  return c.json(hello())
})

let vite: ViteDevServer | undefined

if (isDev) {
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api')) {
      await next()
      return
    }

    try {
      await new Promise<void>((resolveMiddleware, rejectMiddleware) => {
        vite?.middlewares(c.env.incoming, c.env.outgoing, (error?: Error) => {
          if (error) {
            rejectMiddleware(error)
            return
          }

          resolveMiddleware()
        })
      })

      return RESPONSE_ALREADY_SENT
    } catch (error) {
      const err = error as Error
      vite?.ssrFixStacktrace(err)
      return c.text(err.stack ?? err.message, 500)
    }
  })
} else {
  app.use('*', serveStatic({ root: clientDistDir }))

  const indexHtml = await readFile(resolve(clientDistDir, 'index.html'), 'utf8')

  app.get('*', (c) => {
    if (c.req.path.includes('.')) {
      return c.notFound()
    }

    return c.html(indexHtml)
  })
}

const server = createAdaptorServer({ fetch: app.fetch })

if (isDev) {
  const { createServer } = await import('vite')

  vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: { server: server as HttpServer },
    },
  })
}

server.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
