import { createRepo } from "./create-repo.ts";

const repo = createRepo({
	dest: "dist",
	json: "src/generated",
	name: "minifolio",
	defaultBranch: "main",
	author: {
		name: "Minifolio",
		email: "minifolio@example.invalid",
	},
});

await repo.commit({
	message: "Start portfolio notebook",
	date: "2026-01-03T09:00:00Z",
	files: {
		"README.md": `# Minifolio

This generated repository is placeholder content for a cloneable portfolio.

Browse the small notes in about, now, projects, and experiments.
`,
		"about/README.md": `# About

Short placeholder bio for the portfolio owner.

- Location: Somewhere on the internet
- Focus: Useful tools, thoughtful interfaces, and tiny experiments
`,
		"now/README.md": `# Now

Current placeholder status and priorities.

- Drafting the shape of this portfolio repository
- Keeping the content intentionally small
`,
		"projects/README.md": `# Projects

Placeholder index for projects that will be filled in later.
`,
		"experiments/README.md": `# Experiments

Placeholder index for sketches, prototypes, and half-finished ideas.
`,
	},
});

await repo.switchBranch("writing/about", { create: true });
await repo.commit({
	message: "Draft about page voice",
	date: "2026-01-04T10:30:00Z",
	files: {
		"about/README.md": `# About

Short placeholder bio for the portfolio owner.

I like making small web things that feel personal, legible, and easy to clone.

- Location: Somewhere on the internet
- Focus: Useful tools, thoughtful interfaces, and tiny experiments
`,
	},
});

await repo.switchBranch("main");
await repo.commit({
	message: "Update current focus",
	date: "2026-01-05T08:15:00Z",
	files: {
		"now/README.md": `# Now

Current placeholder status and priorities.

- Turning a small portfolio into a Git-native object
- Keeping generated content simple enough to replace
- Leaving room for future visualization work
`,
	},
});

await repo.merge("writing/about", {
	message: "Merge about page draft",
	date: "2026-01-06T16:45:00Z",
});

await repo.tag("v0.1.0");

await repo.switchBranch("experiments/sketchbook", { create: true });
await repo.commit({
	message: "Add experiment sketch notes",
	date: "2026-01-07T11:20:00Z",
	files: {
		"experiments/README.md": `# Experiments

Placeholder index for sketches, prototypes, and half-finished ideas.

- Terminal garden
- Commit graph postcards
- Tiny personal protocol notes
`,
		"experiments/terminal-garden.md": `# Terminal Garden

A placeholder experiment about making a portfolio feel explorable from a shell.
`,
	},
});

await repo.switchBranch("main");
await repo.commit({
	message: "List first project placeholders",
	date: "2026-01-08T14:10:00Z",
	files: {
		"README.md": `# Minifolio

This generated repository is placeholder content for a cloneable portfolio.

Browse the small notes in about, now, projects, and experiments. The main branch
keeps the public-facing shape, while side branches hold visible work-in-progress.
`,
		"projects/README.md": `# Projects

Placeholder index for projects that will be filled in later.

- Minifolio shell
- Portable resume notes
- Personal data sketches
`,
		"projects/minifolio-shell.md": `# Minifolio Shell

A placeholder project entry for a cloneable, Git-backed portfolio surface.
`,
	},
});

await repo.finalize();
