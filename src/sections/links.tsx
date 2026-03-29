import { Bluesky } from "#/svg/bluesky"
import { Github } from "#/svg/github"
import { Resume } from "#/svg/resume"
import './links.css'

export function Links() {
	return (
		<section class="links">
			<a href="https://github.com/sheraff" aria-label="github profile">
				<Github />
				<p>github</p>
			</a>
			<a href="https://bsky.app/profile/sheraff.bsky.social" aria-label="bluesky profile">
				<Bluesky />
				<p>bluesky</p>
			</a>
			<a href="/resume.pdf" aria-label="my resume">
				<Resume />
				<p>resume</p>
			</a>
		</section>
	)
}