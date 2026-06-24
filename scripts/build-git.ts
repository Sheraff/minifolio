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
	date: "2007-06-03T17:00:00Z",
	files: {
		"README.md": `# Minifolio

Cloneable portfolio. Backed by real \`git\`,
and with pseudo-accurate timelines.
`,
		"resume/education.md": `# Education

## 2007
- graduated highschool
`,
	},
});

await repo.commit({
	message: "i guess im going to college",
	date: "2007-07-03T17:00:00Z",
	files: {
		"resume/education.md": `# Education

## 2007
- graduated highschool
- registered to college
`,
	},
});

await repo.commit({
	message: "got accepted to classe prepa",
	date: "2007-09-03T17:00:00Z",
	files: {
		"resume/education.md": `# Education

## 2007
- graduated highschool
- classe préparatoire
`,
	},
});

await repo.switchBranch("tech/101", { create: true });

await repo.commit({
	message: "coding is fun?",
	date: "2008-01-05T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

Matlab
- maze generator and solver
`,
	},
});

await repo.switchBranch("main");

await repo.commit({
	message: "summer job",
	date: "2008-07-15T17:00:00Z",
	files: {
		"resume/jobs.md": `# Jobs

- summer 2008: gardener
`,
	},
});

await repo.commit({
	message: "second year",
	date: "2008-09-03T17:00:00Z",
	files: {
		"resume/education.md": `# Education

## 2008
- classe préparatoire

## 2007
- graduated highschool
- classe préparatoire
`,
	},
});

await repo.switchBranch("tech/101");

await repo.commit({
	message: "coding is fun!",
	date: "2009-01-05T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.switchBranch("main");

await repo.merge("tech/101", {
	message: "Merge matlab tech skills",
	date: "2009-06-06T16:45:00Z",
});

await repo.commit({
	message: "summer job",
	date: "2009-07-02T17:00:00Z",
	files: {
		"resume/jobs.md": `# Jobs

- summer 2009: grape harvest
- summer 2008: gardener
`,
	},
});

await repo.commit({
	message: "i got into engineering school",
	date: "2009-09-05T17:00:00Z",
	files: {
		"resume/education.md": `# Education

## 2009
- ENSC engineering school

## 2008
- classe préparatoire

## 2007
- graduated highschool
- classe préparatoire
`,
	},
});

await repo.switchBranch("tech/courses", { create: true });

await repo.commit({
	message: "new languages?",
	date: "2009-10-28T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

HTML
- web dev intro classes

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.commit({
	message: "weird languages?",
	date: "2010-02-13T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

Prolog
- ???

HTML
- web dev intro classes

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.switchBranch("main");

await repo.switchBranch("travel/vietnam", { create: true });

await repo.commit({
	message: "internship",
	date: "2010-05-15T17:00:00Z",
	files: {
		"resume/jobs.md": `# Jobs

- internship 2010: home for disabled children (vietnam)
- summer 2009: grape harvest (france)
- summer 2008: gardener (france)
`,
	},
});

await repo.commit({
	message: "internship",
	date: "2010-07-01T17:00:00Z",
	files: {
		"resume/jobs.md": `# Jobs

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)
`,
	},
});

await repo.switchBranch("main");

await repo.merge("travel/vietnam", {
	date: "2010-07-15T17:00:00Z",
	message: "i love vietnam",
});

await repo.commit({
	message: "second year",
	date: "2010-09-02T17:00:00Z",
	files: {
		"resume/education.md": `# Education

## 2010
- ENSC engineering school 2nd year

## 2009
- ENSC engineering school

## 2008
- classe préparatoire

## 2007
- graduated highschool
- classe préparatoire
`,
	},
});

await repo.switchBranch("tech/courses");

await repo.commit({
	message: "more programming classes",
	date: "2010-11-27T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.commit({
	message: "side project",
	date: "2010-11-27T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.switchBranch("main");

await repo.merge("tech/courses", {
	date: "2011-04-18T17:00:00Z",
	message: "im done with classes",
});

await repo.switchBranch("university/yale", { create: true });

await repo.commit({
	message: "Yale!",
	date: "2011-05-01T17:00:00Z",
	files: {
		"resume/jobs.md": `# Jobs

## 2011
- internship: Yale University — Cognition and Development lab (united states)

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)
`,
		"skills/tech.md": `# Tech

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab
`,
	},
});

await repo.switchBranch("main");

await repo.merge("university/yale", {
	date: "2011-08-28T17:00:00Z",
	message: "amazing experience, i want more",
});

await repo.commit({
	date: "2011-09-05T17:00:00Z",
	message: "final year",
	files: {
		"resume/education.md": `# Education

## 2010
- ENSC engineering school 3rd year

## 2010
- ENSC engineering school 2nd year

## 2009
- ENSC engineering school

## 2008
- classe préparatoire

## 2007
- graduated highschool
- classe préparatoire
`,
	},
});

await repo.switchBranch("university/mit", { create: true });

await repo.commit({
	message: "finally got out of school",
	date: "2012-01-12T17:00:00Z",
	files: {
		"resume/jobs.md": `# Jobs

## 2012
- academia: Mit Media Lab — Personal Robots (united states)
  research scholar with Cynthia Brezeal

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)
`,
	},
});

await repo.commit({
	message: "i don't know anything",
	date: "2012-02-20T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

C#
- kinect SDK, depth perception, body tracking

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.commit({
	message: "i'm still a noob but i love it",
	date: "2012-03-27T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

C++
- arduino (experimental setup, precise time tracking)
- micro-controllers (motor drive controller)

C#
- kinect SDK, depth perception, body tracking

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.switchBranch("main");

await repo.commit({
	date: "2012-04-05T17:00:00Z",
	message: "negociated, MIT can count as my final year of school",
	files: {
		"resume/education.md": `# Education

## 2009 - 2012
- ENSC engineering school

## 2007 - 2009
- classe préparatoire

## 2007
- graduated highschool
`,
	},
});

await repo.switchBranch("university/mit");

await repo.commit({
	message: "add one more to the list",
	date: "2012-05-03T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

Java
- Android phone as a robot "brain" (dragonbot)

C++
- arduino (experimental setup, precise time tracking)
- micro-controllers (motor drive controller)

C#
- kinect SDK, depth perception, body tracking

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
`,
	},
});

await repo.switchBranch("main");

await repo.switchBranch("open-source/alfred", { create: true });

await repo.commit({
	message: "open source makes me feel good",
	date: "2012-04-20T17:00:00Z",
	files: {
		"projects/alfred.md": `# Alfred

[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
`,
		"skills/tech.md": `# Tech

PHP
- Alfred extension development

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab
`,
	},
});

await repo.commit({
	message: "currency exchange rate alfred extension",
	date: "2012-05-10T17:00:00Z",
	files: {
		"projects/alfred.md": `# Alfred

[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
- Currency Converter
`,
	},
});
await repo.commit({
	message: "google translate alfred extension",
	date: "2012-05-15T17:00:00Z",
	files: {
		"projects/alfred.md": `# Alfred

[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
- Currency Converter
- Google Translate
`,
	},
});
await repo.commit({
	message: "notification automation ios for alfred",
	date: "2012-05-24T17:00:00Z",
	files: {
		"projects/alfred.md": `# Alfred

[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
- Currency Converter
- Google Translate
- Push Dialer — send notifications to OSX / iOS
`,
	},
});
await repo.commit({
	message: "evernote list, open, delete, create alfred extension",
	date: "2012-05-30T17:00:00Z",
	files: {
		"projects/alfred.md": `# Alfred

[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
- Currency Converter
- Google Translate
- Push Dialer — send notifications to OSX / iOS
- Evernote
`,
	},
});
await repo.commit({
	message: "disk alfred extension",
	date: "2012-06-02T17:00:00Z",
	files: {
		"projects/alfred.md": `# Alfred

[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
- Currency Converter
- Google Translate
- Push Dialer — send notifications to OSX / iOS
- Evernote
- Disk Space — how much free disk space do i have
`,
	},
});

await repo.switchBranch("main");

await repo.switchBranch("project/ios", { create: true });

await repo.commit({
	message: "new project!",
	date: "2012-05-28T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

Objective-C & C++ (arduino)
- iOS application: use GPS location to control
  the hands of a physical clock

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab
`,
	},
});

await repo.switchBranch("university/mit");

await repo.switchBranch("university/usc", { create: true });

await repo.commit({
	message: "research trip",
	date: "2012-05-31T17:00:00Z",
	files: {
		"resume/jobs.md": `# Jobs

## 2012
- academia: Mit Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Brezeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić
  (this was just a couple weeks as some "research exchange" + robot delivery)

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)
`,
	},
});

await repo.switchBranch("main");

await repo.merge("project/ios", {
	date: "2012-06-04T17:00:00Z",
	message: "done!",
});

await repo.switchBranch("university/mit");

await repo.merge("university/usc", {
	date: "2012-06-15T17:00:00Z",
	message: "i want to be a researcher",
});

await repo.switchBranch("main");

await repo.commit({
	message: "merge personal and professional projects",
	date: "2012-07-24T17:00:00Z",
	files: {
		"skills/tech.md": `# Tech

Java
- Android phone as a robot "brain" (dragonbot)

C++
- arduino (experimental setup, precise time tracking)
- micro-controllers (motor drive controller)

C#
- kinect SDK, depth perception, body tracking

Objective-C & C++ (arduino)
- iOS application: use GPS location to control
  the hands of a physical clock

ActionScript
- 2D platforming minigames (side projects)

Prolog
- ???

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab
`,
	},
});

await repo.merge("university/mit", {
	date: "2012-08-21T17:00:00Z",
	message: "im going back as soon as i can",
});

await repo.finalize();
