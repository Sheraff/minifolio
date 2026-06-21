
import { Contributions } from "#/sections/contributions"
import { Repositories } from "#/sections/repositories"
import { Articles } from "#/sections/articles"
import { Labs } from "#/sections/labs"
import { Identity } from "#/sections/identity"
import { Head } from "#/sections/head"
import { Links } from "#/sections/links"
import { Footer } from "#/sections/footer"
import { createSignal, lazy, Show, Suspense } from "solid-js"

const Glitch = lazy(() => import('#/svg/glitch'))


function App() {
	const [show, setShow] = createSignal(false)
	setTimeout(() => setShow(true), 5000)
	return (
		<>
			<Links />
			<hr />
			<Head />
			<hr data-big />
			<main>
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
			</main>
			<hr data-big />
			<Footer />
			<div class="rgb-mask" aria-hidden="true" />
			<Suspense>
				<Show when={show()}>
					<Glitch />
				</Show>
			</Suspense>
		</>
	)
}

export default App
