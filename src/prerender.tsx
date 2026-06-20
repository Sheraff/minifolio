import { renderToString } from 'solid-js/web'
import App from './App.tsx'

export function renderShell() {
	return renderToString(() => <body><App /></body>)
}
