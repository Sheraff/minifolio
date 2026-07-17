import { renderToStringAsync } from 'solid-js/web'
import { AppRoot } from './App.tsx'
import type { ServerResourceData } from './createServerResource.ts'

export function renderShell(data: ServerResourceData) {
	return renderToStringAsync(() => <AppRoot serverData={data} />, { timeoutMs: 60_000 })
}
