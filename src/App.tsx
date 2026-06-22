import { Contributions } from "#/sections/contributions";
import { Repositories } from "#/sections/repositories";
import { Articles } from "#/sections/articles";
import { Labs } from "#/sections/labs";
import { Identity } from "#/sections/identity";
import { Head } from "#/sections/head";
import { Links } from "#/sections/links";
import { Footer } from "#/sections/footer";
import { createSignal, lazy, Show, Suspense } from "solid-js";
import { NoHydration } from "solid-js/web";

const Glitch = lazy(() => import("#/svg/glitch"));
const Logs = lazy(() => import("#/sections/logs"));

function App() {
	return (
		<>
			<NoHydration>
				<Links />
				<hr />
				<Head />
				<hr data-big />
			</NoHydration>
			<main>
				<Identity />
				<NoHydration>
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
				</NoHydration>
				<Articles />
				<hr data-big />
				<section>
					<h2>Experiments</h2>
				</section>
				<hr />
				<Labs />
			</main>
			<NoHydration>
				<hr data-big />
				<Footer />
				<div class="rgb-mask" aria-hidden="true" />
			</NoHydration>
			<div style="display:none">
				<DelayedGlitch />
			</div>
			<Suspense>
				<Logs />
			</Suspense>
		</>
	);
}

function DelayedGlitch() {
	const [show, setShow] = createSignal(false);
	setTimeout(() => setShow(true), 5000);
	return (
		<Suspense>
			<Show when={show()}>
				<Glitch />
			</Show>
		</Suspense>
	);
}

export default App;
