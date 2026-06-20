/* @refresh reload */
import { hydrate, isDev, render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'

if (isDev) {
	render(() => <App />, document.body!)
} else {
	hydrate(() => <App />, document.body!)
}
