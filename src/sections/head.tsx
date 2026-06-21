import { Mask } from "#/svg/mask"
import './head.css'

export function Head() {
	return (
		<section class="head">
			<figure>
				<Mask />
				<img src="/unnamed.jpg" alt="Sheraff's github profile picture" loading="lazy" decoding="async"/>
			</figure>
			<h1><a href="https://github.com/sheraff">@sheraff</a></h1>
		</section>
	)
}