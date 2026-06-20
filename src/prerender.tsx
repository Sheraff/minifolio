import { renderToStringAsync } from 'solid-js/web'
import App from './App.tsx'

export function renderShell() {
	return renderToStringAsync(() => <App />)
}
