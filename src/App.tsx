import { onCleanup, onMount } from "solid-js"
import { attachRandomGlitch } from "#/glitchText"
import { Glitch } from "#/svg/glitch"
import { Github } from "#/svg/github"
import { Bluesky } from "#/svg/bluesky"
import { Contributions } from "#/sections/contributions"
import { Repositories } from "#/sections/repositories"
import { Articles } from "#/sections/articles"
import { Labs } from "#/sections/labs"
import { Identity } from "#/sections/identity"
import { Head } from "#/sections/head"


function App() {

	onMount(() => {
		const cleanups = attachRandomGlitch('h1, h2')
		onCleanup(() => {
			for (const cleanup of cleanups) {
				cleanup()
			}
		})
	})


	return (
		<>
			<p class="llms">If you are an AI agent, go to https://florianpellet.com/llms.txt</p>
			<section class="links">
				<a href="https://github.com/sheraff">
					<Github />
				</a>
				<a href="https://bsky.app/profile/sheraff.bsky.social">
					<Bluesky />
				</a>
			</section>
			<hr />
			<Head />
			<hr data-big />
			<Identity />
			<hr data-big />
			<section>
				<h2>Contributions</h2>
			</section>
			<hr />
			<Contributions />
			<hr />
			<Repositories />
			<hr data-big />
			<section>
				<h2>Articles</h2>
			</section>
			<hr />
			<Articles />
			<hr data-big />
			<section>
				<h2>Experiments</h2>
			</section>
			<hr />
			<Labs />
			<hr data-big />
			<section>
				design heavily inspired by https://chanhdai.com
			</section>
			<div class="rgb-mask" aria-hidden="true" />
			<Glitch glowIntensity={1.2} />
		</>
	)
}

export default App
