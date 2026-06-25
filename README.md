# Minifolio

Personal website and portfolio for Florian Pellet, aka [@sheraff](https://github.com/sheraff). It is a Solid/Vite app served by a Hono/Node server, with live GitHub data, articles, code experiments, a browser terminal, optional SSH/finger/git protocol servers, generated OpenGraph images, and resume exports.

## What It Does

- Renders a terminal-inspired portfolio page with links, identity details, GitHub profile imagery, contribution activity, open-source repository contributions, TanStack articles, code experiments, live public logs, and a decorative generated git graph.
- Provides an interactive in-page terminal backed by `just-bash` and the virtual filesystem in `fs/`. It supports common shell commands plus custom commands such as `portfolio`, `mask`, `help`, `git`, `ll`, `whoami`, `hostname`, `history`, and tab completion.
- Serves the same toy terminal over SSH when the SSH server is enabled.
- Serves a small finger service with public user responses when the finger server is enabled.
- Serves a cloneable generated portfolio repository over the git protocol when the git server is enabled.
- Exposes structured JSON APIs for GitHub contributions, contributed repositories, TanStack articles, and lab projects.
- Streams a machine-readable `/llms.txt` summary for crawlers and LLMs.
- Maintains public, anonymous-ish activity logs over `/events` and `/events/stream`, shown in the side rail of the page.
- Generates resume Markdown/PDF exports and social preview images.

## Stack

- SolidJS with SSR/hydration
- Vite multi-environment build for client and server bundles
- Hono on Node for HTTP routing
- TypeScript, Valibot, `just-bash`, `ssh2`
- pnpm for package management

## Requirements

- Node `26.3.1` or compatible with this repo's direct TypeScript execution
- pnpm `11.7.0`
- Git
- A GitHub token for GitHub-backed endpoints: set `GITHUB_TOKEN` or `GH_TOKEN`
- Google Chrome for `resume:pdf` and OpenGraph image generation

Use `pnpm`, not `npm`, for project commands.

```bash
pnpm install
```

## Development

Start the web app in development mode:

```bash
pnpm dev --port 5743
```

Then open `http://localhost:5173`.

The web server only starts when `PORT` or `--port` is provided. Optional protocol servers can be started too:

```bash
pnpm dev --port=5173 --ssh=2222 --finger=7979 --git=9418
```

## Production

Build the app:

```bash
pnpm build
```

Start the production HTTP server:

```bash
pnpm start --port 3000
```

Run `pnpm git:build` before a production build when the generated git graph or cloneable git repository needs to be refreshed:

```bash
pnpm git:build
pnpm build
```

Enable optional production protocol servers with CLI flags:

```bash
pnpm start --port=3000 --ssh=22 --finger=79 --git=9418
```

Production SSH requires `.ssh_host_ed25519_key` in the project root. Development mode generates an ephemeral key if that file is missing.

## HTTP Routes

- `/` serves the portfolio app.
- `/resume.html`, `/resume.pdf`, and `/resume.md` serve resume exports from `public/`.
- `/llms.txt` streams a text summary with identity, resume links, and live site data.
- `/uptime` returns process uptime as plain text.
- `/events` returns recent public log history as text or JSON, depending on `Accept`.
- `/events/stream` streams public logs using Server-Sent Events.
- `/og.png` serves the default OpenGraph image, with Bluesky and Twitter variants selected by crawler user agent.
- `/api/health` returns `{ "ok": true }`.
- `/api/github/contributions` returns the GitHub contribution calendar for `sheraff`.
- `/api/github/repositories` returns repositories `sheraff` has contributed to, excluding owned repositories.
- `/api/articles/tanstack` returns Florian Pellet's TanStack RSS articles.
- `/api/projects` returns lab project metadata from `https://sheraff.github.io/vite-labs/projects.json`.
- `/api/brew?drink=tea` returns `Steeping.`; `/api/brew?drink=coffee` returns HTTP `418`.

API responses are schema-validated and cached in memory. GitHub data refreshes daily; TanStack articles and lab projects refresh hourly.

## Non-HTTP Entrypoints

- Browser terminal: type on the portfolio page, then press Enter. Try `help`, `ls`, `portfolio`, `cat contact.txt`, `cat stack.txt`, or `git log`.
- SSH terminal: `ssh florianpellet.com` in production, or `ssh -p 2222 localhost` in local development when `--ssh=2222` is enabled.
- Git clone: `git clone git://florianpellet.com/` in production, or `git clone git://localhost:9418/` when `--git=9418` is enabled and `pnpm git:build` has created `dist/minifolio.git`.
- Finger: `finger @florianpellet.com` in production, or query the local finger port when enabled.

## Generated Assets

- `pnpm git:build` creates `dist/minifolio.git` and updates `src/generated/minifolio.graph.json` from the scripted portfolio timeline in `scripts/build-git.ts`.
- `pnpm og:image` renders `public/og.png` using Chrome and `og.html`.
- `pnpm og:image:all` renders the default, Bluesky, and Twitter OpenGraph images.
- `pnpm resume:md` converts `public/resume.html` to `public/resume.md`.
- `pnpm resume:pdf` prints `public/resume.html` to `public/resume.pdf` using Chrome.

## Checks

```bash
pnpm check
pnpm test
```

Tests currently cover the browser/SSH terminal core, including autocomplete, identity commands, git command behavior, and path completion.

## Project Layout

- `src/` contains the Solid app, sections, terminal core, styles, OpenGraph renderer, and generated git graph JSON.
- `server/` contains the Hono web server, APIs, public log streaming, prerender runtime, SSH server, finger server, and git protocol server.
- `fs/` is the virtual filesystem exposed inside the browser and SSH terminals.
- `public/` contains static assets, resume exports, OpenGraph images, `humans.txt`, `robots.txt`, and `security.txt`.
- `scripts/` contains generators for the git timeline/repository, OpenGraph screenshots, resume Markdown, CSS inlining, prerender manifests, and git log assets.
