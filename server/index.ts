import { fileURLToPath } from 'node:url'
import {
  createAdaptorServer,
  type HttpBindings,
} from '@hono/node-server'
import { Hono } from 'hono'
import { llms } from './llms.ts'
import { parseArgs } from "node:util"
import { client, devClient } from './client.ts'
import { api } from './api/index.ts'

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

const app = new Hono<{ Bindings: HttpBindings }>()
const server = createAdaptorServer({ fetch: app.fetch })

app.route('/', llms())
app.route("/api", api())

const isDev = parsed.values.dev
if (isDev) {
  app.use('*', await devClient(server))
} else {
	const serverDir = fileURLToPath(new URL('.', import.meta.url))
	app.route('/', client(serverDir))
}

const port = Number(parsed.values.port ?? process.env.PORT ?? 5743)
server.listen(port, () => {
  console.log(`http://localhost:${port}`)
})

const fingerPort = !!parsed.values.finger && Number(parsed.values.finger)
if (fingerPort) {
  const { createFingerServer } = await import('./finger.ts')
  const fingerServer = createFingerServer()
  fingerServer.listen(fingerPort, () => {
    console.log(`Finger server listening on port ${fingerPort}`)
  })
}
