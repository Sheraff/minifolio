import { onCleanup, onMount } from "solid-js"
import { attachRandomGlitch } from "#/glitchText"
import { Glitch } from "#/svg/glitch"
import { Contributions } from "#/sections/contributions"
import { Repositories } from "#/sections/repositories"
import { Articles } from "#/sections/articles"
import { Labs } from "#/sections/labs"
import { Identity } from "#/sections/identity"
import { Head } from "#/sections/head"
import { Links } from "#/sections/links"
import { Footer } from "#/sections/footer"


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
			<Links />
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
			<Footer />
			<div class="rgb-mask" aria-hidden="true" />
			<Glitch glowIntensity={1} />
		</>
	)
}

export default App
