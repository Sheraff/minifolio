import { createServer } from 'node:net'
import { publicLog } from "./public-logs.ts";
import type { ShutdownScope } from './utils/shutdown.ts';

type Values = {
	addr: string
}

function user(template: TemplateStringsArray, ...keys: Array<keyof Values>) {
	const formatted = [...template]
	formatted[0] = formatted[0].trimStart()
	formatted[formatted.length - 1] = formatted.at(-1)!.trimEnd()
	for (let i = 0; i < formatted.length; i++) {
		formatted[i] = formatted[i].replace(/\r?\n/g, '\r\n')
	}
	return function* (values: Values) {
		for (let i = 0; i < formatted.length; i++) {
			yield formatted[i]
			if (i < keys.length) {
				yield values[keys[i]]
			}
		}
	}
}

const users = {
	flo: user`
hello ${'addr'},
how are you?`,
	sheraff: user`
hi ${'addr'},
you know my name.
`
}

export function createFingerServer(parentScope: ShutdownScope) {
	const scope = parentScope.child('finger server', {
		close: () => void server.close(),
	})
	const server = createServer((socket) => {
		socket.setEncoding('utf8')

		const socketScope = scope.child('finger socket', {
			close: () => {
				if (!socket.destroyed) socket.end()
			},
			force: () => void socket.destroy(),
		})

		let query = ''

		socket.on('close', () => socketScope.unregister())

		socket.on('data', (chunk) => {
			query += chunk

			if (query.length > 512) {
				socket.end('Query too long\r\n')
				publicLog(`[WARN] finger too long`);
				return
			}

			if (!query.includes('\n')) return

			const username = query.trim().replace(/^\/W\s+/, '').toLowerCase()

			if (!username) {
				publicLog("[finger] listing request")
				socket.write('Login\tStatus\r\n')
				for (const key in users) {
					socket.write(`${key}\tavailable\r\n`)
				}
				socket.end()
				return
			}

			if (username in users) {
				publicLog(`[finger] request "${username}"`)
				const response = users[username as keyof typeof users]
				for (const line of response({ addr: socket.remoteAddress ?? '***' })) {
					socket.write(line)
				}
				socket.end('\r\n')
				return
			}

			socket.end(`No such user: ${username}\r\n`)
			publicLog(`[finger] unknown user request`);
		})

		socket.on('error', (e) => {
			publicLog(`[WARN] finger socket error`);
			console.error('Socket error:', e)
		})
	})
	server.once('close', () => {
		scope.unregister()
	})
	return server
}
