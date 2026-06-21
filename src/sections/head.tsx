import mask_svg from '#/svg/mask.svg?raw'
import './head.css'

export function Head() {
	return (
		<section class="head">
			<figure>
				<div style="display:contents" innerHTML={mask_svg} />
				<img src="/unnamed.avif" alt="Sheraff's github profile picture" loading="lazy" decoding="async"/>
			</figure>
			<h1><a href="https://github.com/sheraff">@sheraff</a></h1>
		</section>
	)
}