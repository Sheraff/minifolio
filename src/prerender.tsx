import { renderToStringAsync } from 'solid-js/web'
import App from './App.tsx'
import { ServerResourceContext, type ServerResourceData } from './createServerResource.ts'

export function renderShell(data: ServerResourceData) {
	return renderToStringAsync(() => (
		<ServerResourceContext.Provider value={data}>
			<App />
		</ServerResourceContext.Provider>
	), { timeoutMs: 60_000 })
}
