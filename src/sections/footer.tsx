import "./footer.css";

export function Footer() {
	return (
		<footer class="footer">
			<nav aria-label="Other ways to use this site">
				<p>Other ways in:</p>
				<dl>
					<dt>web</dt>
					<dd>
						<a href="https://florianpellet.com">
							https://florianpellet.com
						</a>
					</dd>
					<dt>tty</dt>
					<dd>
						type <code>ls</code> <kbd>⏎</kbd> on this page
					</dd>
					<dt>ssh</dt>
					<dd>
						<code>ssh florianpellet.com</code>
					</dd>
					<dt>git</dt>
					<dd>
						<code>git clone git://florianpellet.com/</code>
					</dd>
					<dt>finger</dt>
					<dd>
						<code>finger @florianpellet.com</code>
					</dd>
					<dt>resume</dt>
					<dd>
						<a href="/resume.html">/resume.</a>(
						<a href="/resume.html">html</a>|<a href="/resume.pdf">pdf</a>|
						<a href="/resume.md">md</a>)
					</dd>
					<dt>llms</dt>
					<dd>
						<a href="/llms.txt">/llms.txt</a>
					</dd>
				</dl>
			</nav>
			<p class="footer-credits">
				Design heavily inspired by{" "}
				<a href="https://chanhdai.com">https://chanhdai.com</a>. The source
				code is{" "}
				<a href="https://github.com/sheraff/minifolio">
					available on GitHub
				</a>
				.
			</p>
		</footer>
	);
}
