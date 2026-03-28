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
				<dl>
					<dt>whoami</dt>
					<dd>sheraff</dd>
					<dt>hostname -f</dt>
					<dd>florianpellet.com</dd>
					<dt>git config user.email</dt>
					<dd>fpellet@ensc.fr</dd>
					<dt>date +%H:%M</dt>
					<dd><Time /><TimeDifference /></dd>
					{/* <dt>|</dt> */}
					{/* Staff frontend engineer */}
					{/* he/him */}
					{/* Europe/Paris */}
				</dl>
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
