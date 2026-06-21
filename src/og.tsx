import { render } from "solid-js/web";
import maskSvg from "#/svg/mask.svg?raw";
import "./index.css";
import "./og.css";

function OgCard() {
	return (
		<>
			<main>
				<figure aria-hidden="true">
					<div style="display:contents" innerHTML={maskSvg} />
				</figure>
				<section>
					<h1>@sheraff</h1>
					<p>I'm a web worker</p>
				</section>
			</main>
			<div class="line-h" />
			<div class="line-v" />
			<div class="rgb-mask" aria-hidden="true" />
		</>
	);
}

render(() => <OgCard />, document.body!);
