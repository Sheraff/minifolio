import bluesky_svg from '#/svg/bluesky.svg?raw'
import github_svg from '#/svg/github.svg?raw'
import resume_svg from '#/svg/resume.svg?raw'
import './links.css'

export function Links() {
	return (
		<section class="links">
			<a href="https://github.com/sheraff" aria-label="github profile">
				<div style="display:contents" innerHTML={github_svg} />
				<p>github</p>
			</a>
			<a href="https://bsky.app/profile/sheraff.dev" aria-label="bluesky profile">
				<div style="display:contents" innerHTML={bluesky_svg} />
				<p>bluesky</p>
			</a>
			<a href="/resume.pdf" aria-label="my resume">
				<div style="display:contents" innerHTML={resume_svg} />
				<p>resume</p>
			</a>
		</section>
	)
}
