/* @refresh reload */
import { hydrate, isDev, render } from 'solid-js/web'
import './index.css'
import { AppRoot } from './App.tsx'

if (isDev) {
	render(() => <AppRoot />, document.body!)
} else {
	hydrate(() => <AppRoot />, document.body!)
}
