import { Glitch } from "./svg/glitch"
import { Mask } from "./svg/mask"
import { Github } from "./svg/github"
import { Bluesky } from "./svg/bluesky"
import { Contributions } from "./sections/contributions"
import { Time, TimeDifference } from "./time"
import { Repositories } from "./sections/repositories"
import { Articles } from "./sections/articles"
import { Labs } from "./sections/labs"


function App() {
	return (
		<>
			<section class="links">
				<a href="https://github.com/sheraff">
					<Github />
				</a>
				<a href="https://bsky.app/profile/sheraff.bsky.social">
					<Bluesky />
				</a>
			</section>
			<hr />
			<section class="head">
				<Mask />
				<h1><a href="https://github.com/sheraff">@sheraff</a></h1>
			</section>
			<hr />
			<hr data-big />
			<section class="identity">
				<ul>
					<li>Staff frontend engineer</li>
					<li>Paris, France</li>
					<li>florianpellet.com</li>
					<li>fpel_TEMP_let [@] en_TEMP_sc [.] fr</li>
					<li><Time /><TimeDifference /></li>
					<li>he/him</li>
				</ul>
			</section>
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
			<Glitch />
		</>
	)
}

export default App
