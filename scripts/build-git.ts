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

await repo.merge("university/mit", {
	date: "2012-08-21T17:00:00Z",
	message: "im going back as soon as i can",
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

await repo.switchBranch("open-source/alfred");

await repo.commit({
	date: "2012-09-12T17:00:00Z",
	message: "into the dark arts",
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
- PirateBay — search torrents
`,
	},
});

await repo.commit({
	date: "2012-09-12T17:00:00Z",
	message: "more torrents",
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
- PirateBay — search torrents
- Transmission — control Transmission torrent application from alfred
`,
	},
});

function markdown(title: string, body: string) {
	return `# ${title}

${body.trim()}
`;
}

await repo.commit({
	message: "misc alfred toys",
	date: "2012-10-07T17:00:00Z",
	files: {
		"projects/alfred.md": markdown(
			"Alfred",
			`[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
- Currency Converter
- Google Translate
- Push Dialer — send notifications to OSX / iOS
- Evernote
- Disk Space — how much free disk space do i have
- PirateBay — search torrents
- Transmission — control Transmission torrent application from alfred
- Tastekid
- todo app bridge
- Adium helper
- Le Tourne Disque`,
		),
	},
});

await repo.commit({
	message: "tv shows in a launcher, obviously",
	date: "2012-12-02T17:00:00Z",
	files: {
		"projects/alfred.md": markdown(
			"Alfred",
			`[Alfred](https://www.alfredapp.com/) is a launcher for macos
that can use 3rd party open source extensions

Extensions:
- urban dictionary (to help me learn american slang)
- Currency Converter
- Google Translate
- Push Dialer — send notifications to OSX / iOS
- Evernote
- Disk Space — how much free disk space do i have
- PirateBay — search torrents
- Transmission — control Transmission torrent application from alfred
- Tastekid
- todo app bridge
- Adium helper
- Le Tourne Disque
- TV Shows — keep track of what aired and what to watch next`,
		),
		"skills/tech.md": markdown(
			"Tech",
			`Node.js
- Alfred extension for TV show tracking

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
- experimental design & data collection for experimental psychology lab`,
		),
	},
});

await repo.switchBranch("main");
await repo.switchBranch("lab/cmu", { create: true });

await repo.commit({
	message: "new lab, colder lab",
	date: "2012-11-12T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
	},
});

await repo.commit({
	message: "python and robots",
	date: "2013-02-04T17:00:00Z",
	files: {
		"skills/tech.md": markdown(
			"Tech",
			`Python
- robotics research scripts
- experiment tooling

Bash
- lab automation and data processing

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
- experimental design & data collection for experimental psychology lab`,
		),
		"skills/research.md": markdown(
			"Research",
			`Robotics
- human-robot interaction
- autonomous systems lab work
- experimental setup and data collection

Tools
- Python and Bash for data cleaning
- Matlab for experiments and analysis
- Arduino / Kinect / Android robotics stacks`,
		),
	},
});

await repo.commit({
	message: "wrap cmu notes",
	date: "2013-05-08T17:00:00Z",
	files: {
		"projects/robotics.md": markdown(
			"Robotics Research",
			`Labs:
- Yale Cognition and Development Lab
- MIT Media Lab — Personal Robots
- USC Robotics and Autonomous Systems Center
- CMU Reliable Autonomous Systems Lab

Work:
- social robotics experiments
- robot sensing and control glue code
- data collection, cleaning, and analysis
- enough hardware work to learn that hardware always wins`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("lab/cmu", {
	date: "2013-05-12T17:00:00Z",
	message: "robots, but maybe not forever",
});

const techAfterAlfredAndCmu = markdown(
	"Tech",
	`Node.js
- Alfred extension for TV show tracking

PHP
- Alfred extension development

Python
- robotics research scripts
- experiment tooling

Bash
- lab automation and data processing

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
- experimental design & data collection for experimental psychology lab`,
);

await repo.merge("open-source/alfred", {
	date: "2013-05-18T17:00:00Z",
	message: "a weird amount of launcher extensions",
	files: {
		"skills/tech.md": techAfterAlfredAndCmu,
	},
});

await repo.switchBranch("road/volcano", { create: true });

await repo.commit({
	message: "volcano trails",
	date: "2013-06-06T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2013
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
	},
});

await repo.commit({
	message: "boat life",
	date: "2013-09-09T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("road/volcano", {
	date: "2013-10-13T17:00:00Z",
	message: "back with stranger stories",
});

await repo.switchBranch("road/khmer", { create: true });

await repo.commit({
	message: "dive shop website",
	date: "2014-03-19T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2014
- job: web developer for a scuba diving shop (cambodia)

## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
		"skills/tech.md": markdown(
			"Tech",
			`PHP
- Alfred extension development
- scuba diving shop website

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes
- small client websites
- animation and layout experiments

Node.js
- Alfred extension for TV show tracking

Python
- robotics research scripts
- experiment tooling

Bash
- lab automation and data processing

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

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab`,
		),
	},
});

await repo.commit({
	message: "coffee and css",
	date: "2014-05-22T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2014
- job: web developer for a scuba diving shop (cambodia)
- job: barista for a resort (cambodia)

## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
	},
});

await repo.commit({
	message: "small web things",
	date: "2014-08-03T17:00:00Z",
	files: {
		"projects/web-experiments.md": markdown(
			"Web Experiments",
			`2014 was mostly sketches:
- CSS animations
- little canvas toys
- single-page prototypes
- PHP forms and tiny admin screens
- no product, just a lot of curiosity`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("road/khmer", {
	date: "2014-08-15T17:00:00Z",
	message: "web keeps following me",
});

await repo.switchBranch("lab/lscp", { create: true });

await repo.commit({
	message: "back to research",
	date: "2014-09-08T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2014 - 2015
- research assistant: CNRS — LSCP (france)
  with Brent Strickland

## 2014
- job: web developer for a scuba diving shop (cambodia)
- job: barista for a resort (cambodia)

## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
		"skills/research.md": markdown(
			"Research",
			`Cognitive science
- experimental design
- statistics
- literature review
- data collection and cleaning

Domains
- psychology
- neuroscience
- primatology
- linguistics
- epistemology

Robotics
- human-robot interaction
- autonomous systems lab work
- experimental setup and data collection`,
		),
	},
});

await repo.commit({
	message: "R, finally",
	date: "2014-11-12T17:00:00Z",
	files: {
		"skills/tech.md": markdown(
			"Tech",
			`R
- statistics
- experiment data analysis

Javascript
- browser-based psychology experiments
- small research tools

PHP
- Alfred extension development
- scuba diving shop website

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes
- small client websites
- animation and layout experiments

Node.js
- Alfred extension for TV show tracking

Python
- robotics research scripts
- experiment tooling

Bash
- lab automation and data processing

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

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab`,
		),
	},
});

await repo.switchBranch("main");
await repo.switchBranch("toy/comics", { create: true });

await repo.commit({
	message: "first real website",
	date: "2015-02-21T17:00:00Z",
	files: {
		"projects/whiteboard-comics.md": markdown(
			"Whiteboard Comics",
			`whiteboard-comics.com

First real website I made for myself.

It used animated SVGs and a tiny custom publishing flow.
It kept existing, somehow, until 2020.`,
		),
		"skills/tech.md": markdown(
			"Tech",
			`SVG
- animated comics
- tiny illustration pipeline

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes
- small client websites
- animation and layout experiments
- first real personal website

PHP
- Alfred extension development
- scuba diving shop website

Node.js
- Alfred extension for TV show tracking

Python
- robotics research scripts
- experiment tooling

Bash
- lab automation and data processing

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

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab`,
		),
	},
});

await repo.commit({
	message: "svgs are little programs",
	date: "2015-06-06T17:00:00Z",
	files: {
		"projects/whiteboard-comics.md": markdown(
			"Whiteboard Comics",
			`whiteboard-comics.com

First real website I made for myself.

It used animated SVGs and a tiny custom publishing flow.
The fun part was treating each drawing as something between an image,
an animation timeline, and code.

It kept existing, somehow, until 2020.`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("toy/comics", {
	date: "2015-07-02T17:00:00Z",
	message: "i made a website for myself",
});

const techAfterLscpAndComics = markdown(
	"Tech",
	`R
- statistics
- experiment data analysis

Javascript
- browser-based psychology experiments
- small research tools
- animation and layout experiments

SVG
- animated comics
- tiny illustration pipeline

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes
- small client websites
- first real personal website

PHP
- Alfred extension development
- scuba diving shop website

Node.js
- Alfred extension for TV show tracking

Python
- robotics research scripts
- experiment tooling

Bash
- lab automation and data processing

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

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab`,
);

await repo.merge("lab/lscp", {
	date: "2015-08-28T17:00:00Z",
	message: "research muscles",
	files: {
		"skills/tech.md": techAfterLscpAndComics,
	},
});

await repo.switchBranch("phd/ijn", { create: true });

await repo.commit({
	message: "not leaving research yet",
	date: "2015-09-14T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2015 - 2018
- doctoral student in epistemology: Jean Nicod Institute (france)
  with Emmanuel Chemla

## 2014 - 2015
- research assistant: CNRS — LSCP (france)
  with Brent Strickland

## 2014
- job: web developer for a scuba diving shop (cambodia)
- job: barista for a resort (cambodia)

## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
		"resume/education.md": markdown(
			"Education",
			`## 2015 - 2018
- doctoral research in epistemology — Jean Nicod Institute / ENS Ulm / CNRS

## 2009 - 2012
- ENSC engineering school

## 2007 - 2009
- classe préparatoire

## 2007
- graduated highschool`,
		),
	},
});

await repo.commit({
	message: "models, stats, papers",
	date: "2016-05-03T17:00:00Z",
	files: {
		"skills/research.md": markdown(
			"Research",
			`Epistemology and cognitive science
- experimental design
- statistics
- literature review
- paper writing
- cross-domain work with psychology, linguistics, neuroscience, and philosophy

Doctoral work
- Jean Nicod Institute
- Emmanuel Chemla
- pragmatic reasoning and formal models

Robotics
- human-robot interaction
- autonomous systems lab work
- experimental setup and data collection`,
		),
	},
});

await repo.commit({
	message: "maybe the web is the part i miss",
	date: "2017-11-18T17:00:00Z",
	files: {
		"projects/web-experiments.md": markdown(
			"Web Experiments",
			`2014-2017 was mostly sketches:
- CSS animations
- little canvas toys
- single-page prototypes
- PHP forms and tiny admin screens
- browser-based experiments for research
- no product, just a lot of curiosity

The pattern is getting obvious: even in research,
I keep reaching for the browser as my medium.`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("phd/ijn", {
	date: "2018-02-20T17:00:00Z",
	message: "close the research chapter",
});

await repo.commit({
	message: "front-end catch up",
	date: "2018-09-10T17:00:00Z",
	files: {
		"skills/tech.md": markdown(
			"Tech",
			`Javascript
- browser-based psychology experiments
- small research tools
- animation and layout experiments
- modern frontend catch-up

CSS
- layout
- animation
- responsive websites

R
- statistics
- experiment data analysis

SVG
- animated comics
- tiny illustration pipeline

HTML / CSS / Javascript
- web dev intro classes
- 2nd year programming classes
- small client websites
- first real personal website

PHP
- Alfred extension development
- scuba diving shop website

Node.js
- Alfred extension for TV show tracking

Python
- robotics research scripts
- experiment tooling

Bash
- lab automation and data processing

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

Matlab
- maze generator and solver
- A* path finding
- experimental design & data collection for experimental psychology lab`,
		),
	},
});

await repo.switchBranch("agency/louvre", { create: true });

await repo.commit({
	message: "agency life",
	date: "2019-01-07T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2019 - 2022
- frontend developer: Mazarine (france)
  agency websites, luxury clients, museums, deadlines

## 2015 - 2018
- doctoral student in epistemology: Jean Nicod Institute (france)
  with Emmanuel Chemla

## 2014 - 2015
- research assistant: CNRS — LSCP (france)
  with Brent Strickland

## 2014
- job: web developer for a scuba diving shop (cambodia)
- job: barista for a resort (cambodia)

## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
		"skills/tech.md": markdown(
			"Tech",
			`Frontend
- agency websites
- vanilla JavaScript
- CSS architecture
- accessibility
- responsive interfaces

CMS / ecommerce
- Magento
- WordPress-ish workflows
- client handoff constraints

Javascript
- browser-based psychology experiments
- small research tools
- animation and layout experiments
- modern frontend catch-up

CSS
- layout
- animation
- responsive websites

R
- statistics
- experiment data analysis

SVG
- animated comics
- tiny illustration pipeline

PHP
- Alfred extension development
- scuba diving shop website

Node.js
- Alfred extension for TV show tracking

Python
- robotics research scripts
- experiment tooling`,
		),
	},
});

await repo.commit({
	message: "dozens of launches",
	date: "2020-02-11T17:00:00Z",
	files: {
		"projects/agency-sites.md": markdown(
			"Agency Sites",
			`Mazarine years:
- dozens of launches
- changing stacks
- fixed budgets
- hard deadlines
- frontend rescue missions late in delivery

Stacks included:
- Magento
- vanilla JavaScript
- Next.js
- Vue
- Svelte
- React
- a lot of CSS`,
		),
	},
});

await repo.commit({
	message: "louvre.fr",
	date: "2020-11-02T17:00:00Z",
	files: {
		"projects/louvre-fr.md": markdown(
			"louvre.fr",
			`Led frontend development for the new www.louvre.fr at Mazarine.

Work:
- frontend architecture
- responsive implementation
- accessibility constraints
- content-heavy pages
- production hardening
- agency delivery under museum-scale expectations`,
		),
	},
});

await repo.switchBranch("oss/next", { create: true });

await repo.commit({
	message: "my first big OSS PR landed",
	date: "2021-09-19T17:51:05Z",
	files: {
		"open-source/nextjs.md": markdown(
			"Next.js",
			`PR: https://github.com/vercel/next.js/pull/22818

Fix:
- don't prefetch modules that were already preloaded
- avoid duplicate JavaScript requests
- the first time an OSS contribution to a major project felt real`,
		),
	},
});

await repo.switchBranch("agency/louvre");

await repo.merge("oss/next", {
	date: "2021-09-23T17:00:00Z",
	message: "i am still smiling about next.js",
});

await repo.commit({
	message: "stabilize the late ones",
	date: "2022-03-12T17:00:00Z",
	files: {
		"projects/agency-sites.md": markdown(
			"Agency Sites",
			`Mazarine years:
- dozens of launches
- changing stacks
- fixed budgets
- hard deadlines
- frontend rescue missions late in delivery

Stacks included:
- Magento
- vanilla JavaScript
- Next.js
- Vue
- Svelte
- React
- a lot of CSS

The recurring job: make fragile frontends shippable.`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("agency/louvre", {
	date: "2022-04-22T17:00:00Z",
	message: "agency era shipped",
});

await repo.switchBranch("saas/matera", { create: true });

await repo.commit({
	message: "new monorepo",
	date: "2022-05-09T17:00:00Z",
	files: {
		"resume/jobs.md": markdown(
			"Jobs",
			`## 2022 - present
- staff frontend engineer: Matera (france)
  SaaS product, frontend platform, developer experience

## 2019 - 2022
- frontend developer: Mazarine (france)
  agency websites, luxury clients, museums, deadlines

## 2015 - 2018
- doctoral student in epistemology: Jean Nicod Institute (france)
  with Emmanuel Chemla

## 2014 - 2015
- research assistant: CNRS — LSCP (france)
  with Brent Strickland

## 2014
- job: web developer for a scuba diving shop (cambodia)
- job: barista for a resort (cambodia)

## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
		),
		"projects/matera-platform.md": markdown(
			"Matera Frontend Platform",
			`A 1M+ LoC frontend monorepo that needed a platform reset.

Focus:
- developer experience
- type safety
- tooling
- shared UI
- build speed
- bundle size`,
		),
	},
});

await repo.commit({
	message: "typescript in the walls",
	date: "2022-08-18T17:00:00Z",
	files: {
		"skills/tech.md": markdown(
			"Tech",
			`TypeScript
- introduced into a large JavaScript codebase
- generated types
- API typing
- migration scripts

React
- SaaS application frontend
- shared UI patterns
- form and navigation infrastructure

Frontend tooling
- monorepos
- custom ESLint rules
- migration scripts
- CI workflows

Frontend
- agency websites
- vanilla JavaScript
- CSS architecture
- accessibility
- responsive interfaces

Next.js / Vue / Svelte
- agency production websites

Node.js
- tooling
- scripts
- Alfred extension for TV show tracking

R
- statistics
- experiment data analysis

Python / Bash
- robotics research scripts
- lab automation and data processing`,
		),
	},
});

await repo.switchBranch("main");
await repo.switchBranch("oss/raycast", { create: true });

await repo.commit({
	message: "raycast dictionary",
	date: "2022-09-20T19:04:56Z",
	files: {
		"open-source/raycast.md": markdown(
			"Raycast",
			`Contributions to raycast/extensions:

- Urban Dictionary search
  https://github.com/raycast/extensions/pull/2924`,
		),
		"skills/tech.md": markdown(
			"Tech",
			`TypeScript
- Raycast extension development
- open-source contribution workflow

Frontend
- agency websites
- vanilla JavaScript
- CSS architecture
- accessibility
- responsive interfaces

Next.js / Vue / Svelte
- agency production websites

Node.js
- tooling
- scripts
- Alfred extension for TV show tracking

R
- statistics
- experiment data analysis

Python / Bash
- robotics research scripts
- lab automation and data processing`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("oss/raycast", {
	date: "2022-10-02T17:00:00Z",
	message: "raycast scratches the alfred itch",
});

await repo.switchBranch("saas/matera");

await repo.commit({
	message: "vite all the things",
	date: "2022-11-16T17:00:00Z",
	files: {
		"projects/matera-platform.md": markdown(
			"Matera Frontend Platform",
			`A 1M+ LoC frontend monorepo that needed a platform reset.

Work:
- introduced TypeScript into a JavaScript codebase
- migrated Webpack to Vite
- redesigned imports and bundling
- cut initial JavaScript from 9MB to 2MB
- made build feedback loops survivable`,
		),
	},
});

await repo.switchBranch("main");
await repo.switchBranch("oss/trpc", { create: true });

await repo.commit({
	message: "can batched requests stream?",
	date: "2023-05-11T08:27:23Z",
	files: {
		"open-source/trpc.md": markdown(
			"tRPC",
			`Started working on out-of-order streaming for batched requests.

Goal:
- slow procedures should not block faster procedures in the same batch
- keep the client API usable
- support the server adapters people actually use`,
		),
	},
});

await repo.commit({
	message: "streaming batch link lands",
	date: "2023-06-02T13:31:11Z",
	files: {
		"open-source/trpc.md": markdown(
			"tRPC",
			`Core contribution: out-of-order streaming for batched requests.

PRs:
- https://github.com/trpc/trpc/pull/4347
- follow-up compatibility and adapter fixes

Work:
- client stream parsing
- Node adapter
- Fastify adapter
- Fetch adapter
- docs and tests
- compatibility cleanup after release`,
		),
		"skills/tech.md": markdown(
			"Tech",
			`TypeScript
- library internals
- typed APIs
- streaming protocols

tRPC
- out-of-order streaming for batched requests
- client/server adapter work
- Node, Fastify, Fetch

Web Streams
- streamed JSON responses
- progressive parsing
- compatibility across runtimes

React Query
- client data fetching mental model

Node.js
- tooling
- scripts
- HTTP adapters`,
		),
	},
});

await repo.commit({
	message: "a year in trpc",
	date: "2024-05-18T17:00:00Z",
	files: {
		"open-source/trpc.md": markdown(
			"tRPC",
			`Core contribution: out-of-order streaming for batched requests.

PRs:
- https://github.com/trpc/trpc/pull/4347
- follow-up compatibility and adapter fixes

Work:
- client stream parsing
- Node adapter
- Fastify adapter
- Fetch adapter
- docs and tests
- compatibility cleanup after release

This was the first OSS arc that felt like being part of a library team,
not just sending a drive-by patch.`,
		),
	},
});

const techAfterTrpc = markdown(
	"Tech",
	`TypeScript
- library internals
- typed APIs
- streaming protocols
- Raycast extension development
- open-source contribution workflow

tRPC
- out-of-order streaming for batched requests
- client/server adapter work
- Node, Fastify, Fetch

Web Streams
- streamed JSON responses
- progressive parsing
- compatibility across runtimes

React Query
- client data fetching mental model

Frontend
- agency websites
- vanilla JavaScript
- CSS architecture
- accessibility
- responsive interfaces

Next.js / Vue / Svelte
- agency production websites

Node.js
- tooling
- scripts
- HTTP adapters
- Alfred extension for TV show tracking

R
- statistics
- experiment data analysis

Python / Bash
- robotics research scripts
- lab automation and data processing`,
);

await repo.switchBranch("main");

await repo.merge("oss/trpc", {
	date: "2024-05-22T17:00:00Z",
	message: "stream the batch",
	files: {
		"skills/tech.md": techAfterTrpc,
	},
});

await repo.switchBranch("home/tunes", { create: true });

await repo.commit({
	message: "music app for one user",
	date: "2023-09-04T17:00:00Z",
	files: {
		"projects/soft-serve-tunes.md": markdown(
			"Soft Serve Tunes",
			`Personal music app.

Used every day since 2023.

Stack:
- Raspberry Pi hosting
- Next.js
- tRPC
- Prisma
- PostgreSQL
- PWA
- service worker
- websockets`,
		),
	},
});

await repo.commit({
	message: "offline-ish jukebox",
	date: "2023-12-28T17:00:00Z",
	files: {
		"projects/soft-serve-tunes.md": markdown(
			"Soft Serve Tunes",
			`Personal music app.

Used every day since 2023.

Stack:
- Raspberry Pi hosting
- Next.js
- tRPC
- Prisma
- PostgreSQL
- PWA
- service worker
- websockets

Why it matters:
- real product pressure from one very demanding user: me
- local-network reliability
- background sync
- fast queue interactions`,
		),
	},
});

const techAfterTunes = markdown(
	"Tech",
	`TypeScript
- library internals
- typed APIs
- streaming protocols
- personal products

Next.js
- agency production websites
- personal music app

tRPC
- out-of-order streaming for batched requests
- client/server adapter work
- personal app API

Prisma / PostgreSQL
- soft-serve-tunes data model

PWA / service worker / websockets
- offline-ish music app behavior
- realtime queue updates

React Query
- client data fetching mental model

Web Streams
- streamed JSON responses
- progressive parsing
- compatibility across runtimes

Frontend
- agency websites
- vanilla JavaScript
- CSS architecture
- accessibility
- responsive interfaces

Node.js
- tooling
- scripts
- HTTP adapters
- Raspberry Pi hosting

R
- statistics
- experiment data analysis

Python / Bash
- robotics research scripts
- lab automation and data processing`,
);

await repo.switchBranch("main");

await repo.merge("home/tunes", {
	date: "2024-01-06T17:00:00Z",
	message: "the app i actually use",
	files: {
		"skills/tech.md": techAfterTunes,
	},
});

await repo.switchBranch("labs/vite", { create: true });

await repo.commit({
	message: "new lab bench",
	date: "2024-04-04T17:00:00Z",
	files: {
		"projects/vite-labs.md": markdown(
			"Vite Labs",
			`A playground for browser and performance experiments.

Areas:
- algorithms
- 2D canvas
- SharedArrayBuffer
- web workers
- parallelism
- WebGPU
- performance measurement`,
		),
	},
});

await repo.commit({
	message: "workers, buffers, pixels",
	date: "2024-09-16T17:00:00Z",
	files: {
		"projects/vite-labs.md": markdown(
			"Vite Labs",
			`A playground for browser and performance experiments.

Areas:
- algorithms
- 2D canvas
- SharedArrayBuffer
- web workers
- parallelism
- WebGPU
- performance measurement

This is where I try the things that are too weird,
too visual, or too low-level for product work.`,
		),
	},
});

const techAfterViteLabs = markdown(
	"Tech",
	`TypeScript
- library internals
- typed APIs
- streaming protocols
- personal products
- browser experiments

Performance
- benchmarking
- profiling
- flamegraphs
- bundle-size analysis

Canvas / Web Workers / SharedArrayBuffer / WebGPU
- Vite Labs experiments
- parallel browser workloads

Next.js
- agency production websites
- personal music app

tRPC
- out-of-order streaming for batched requests
- client/server adapter work
- personal app API

Prisma / PostgreSQL
- soft-serve-tunes data model

PWA / service worker / websockets
- offline-ish music app behavior
- realtime queue updates

React Query
- client data fetching mental model

Frontend
- agency websites
- vanilla JavaScript
- CSS architecture
- accessibility
- responsive interfaces

Node.js
- tooling
- scripts
- HTTP adapters
- Raspberry Pi hosting

R
- statistics
- experiment data analysis

Python / Bash
- robotics research scripts
- lab automation and data processing`,
);

await repo.switchBranch("main");

await repo.merge("labs/vite", {
	date: "2024-10-01T17:00:00Z",
	message: "keep a lab open",
	files: {
		"skills/tech.md": techAfterViteLabs,
	},
});

await repo.switchBranch("saas/matera");

await repo.commit({
	message: "one data layer",
	date: "2023-07-14T17:00:00Z",
	files: {
		"projects/matera-platform.md": markdown(
			"Matera Frontend Platform",
			`A 1M+ LoC frontend monorepo that needed a platform reset.

Work:
- introduced TypeScript into a JavaScript codebase
- migrated Webpack to Vite
- redesigned imports and bundling
- cut initial JavaScript from 9MB to 2MB
- defined a shared type-safe data layer on React Query
- generated query keys and integrated types
- replaced bespoke service code with one path for fetching, caching, mutations, and invalidation`,
		),
	},
});

await repo.commit({
	message: "ui platform for backend people",
	date: "2024-03-18T17:00:00Z",
	files: {
		"projects/matera-platform.md": markdown(
			"Matera Frontend Platform",
			`A 1M+ LoC frontend monorepo that needed a platform reset.

Work:
- introduced TypeScript into a JavaScript codebase
- migrated Webpack to Vite
- redesigned imports and bundling
- cut initial JavaScript from 9MB to 2MB
- defined a shared type-safe data layer on React Query
- generated query keys and integrated types
- built a 40+ component design system
- built in-app devtools for forms, state machines, and navigation`,
		),
	},
});

await repo.commit({
	message: "eslint as migration engine",
	date: "2025-02-26T17:00:00Z",
	files: {
		"projects/matera-platform.md": markdown(
			"Matera Frontend Platform",
			`A 1M+ LoC frontend monorepo that needed a platform reset.

Work:
- introduced TypeScript into a JavaScript codebase
- migrated Webpack to Vite
- redesigned imports and bundling
- cut initial JavaScript from 9MB to 2MB
- defined a shared type-safe data layer on React Query
- generated query keys and integrated types
- built a 40+ component design system
- built in-app devtools for forms, state machines, and navigation
- rewrote CI for parallel execution
- authored 20+ custom ESLint rules and migration scripts
- added code-health dashboards and CLI tools`,
		),
	},
});

await repo.switchBranch("main");
await repo.switchBranch("oss/tanstack", { create: true });

await repo.commit({
	message: "tanstack rabbit hole",
	date: "2025-01-20T17:00:00Z",
	files: {
		"open-source/tanstack.md": markdown(
			"TanStack",
			`Started contributing across TanStack Router and related packages.

Focus:
- correctness
- routing internals
- performance
- cross-framework behavior
- benchmarks`,
		),
	},
});

await repo.commit({
	message: "route tree, not flat list",
	date: "2025-11-15T12:45:03Z",
	files: {
		"open-source/tanstack.md": markdown(
			"TanStack",
			`TanStack Router / Start work.

Route matching rewrite:
- https://github.com/TanStack/router/pull/5722
- replaced flat route matching with a segment tree
- moved matching from route-count-driven work to path-depth-driven work
- measured large speedups on big route trees
- fixed priority and correctness edge cases along the way`,
		),
	},
});

await repo.commit({
	message: "signals everywhere",
	date: "2026-03-12T17:00:00Z",
	files: {
		"open-source/tanstack.md": markdown(
			"TanStack",
			`TanStack Router / Start work.

Route matching rewrite:
- https://github.com/TanStack/router/pull/5722
- replaced flat route matching with a segment tree

Reactive core refactor:
- moved router internals toward granular stores / signals
- worked across React, Solid, and Vue packages
- reduced unnecessary re-renders
- turned performance work into benchmarks and flamegraphs`,
		),
		"writing/tanstack.md": markdown(
			"TanStack Writing",
			`Articles:

- TanStack Router's New Reactive Core: A Signal Graph
  https://tanstack.com/blog/tanstack-router-signal-graph`,
		),
	},
});

await repo.commit({
	message: "ssr hot paths",
	date: "2026-06-11T08:58:01Z",
	files: {
		"open-source/tanstack.md": markdown(
			"TanStack",
			`TanStack Router / Start work.

Route matching rewrite:
- https://github.com/TanStack/router/pull/5722
- replaced flat route matching with a segment tree

Reactive core refactor:
- moved router internals toward granular stores / signals
- worked across React, Solid, and Vue packages
- reduced unnecessary re-renders

SSR performance:
- profiled hot paths in TanStack Start
- removed avoidable work from server rendering
- helped drive 5x throughput improvements in benchmarks`,
		),
		"writing/tanstack.md": markdown(
			"TanStack Writing",
			`Articles:

- TanStack Router's New Reactive Core: A Signal Graph
  https://tanstack.com/blog/tanstack-router-signal-graph
- 5x SSR Throughput: Profiling SSR Hot Paths in TanStack Start
  https://tanstack.com/blog/tanstack-start-5x-ssr-throughput
- How we accidentally made route matching more performant by aiming for correctness
  https://tanstack.com/blog/tanstack-router-route-matching-tree-rewrite`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("oss/tanstack", {
	date: "2026-06-16T17:00:00Z",
	message: "maintainer brain unlocked",
});

await repo.switchBranch("oss/raycast");

await repo.commit({
	message: "raycast mdn",
	date: "2026-03-27T14:48:20Z",
	files: {
		"open-source/raycast.md": markdown(
			"Raycast",
			`Contributions to raycast/extensions:

- Urban Dictionary search
  https://github.com/raycast/extensions/pull/2924
- Search MDN improvements
  https://github.com/raycast/extensions/pull/25918

The second one added richer MDN results, browser-compatibility metadata,
and better defaults for opening docs.`,
		),
	},
});

await repo.switchBranch("main");

await repo.merge("oss/raycast", {
	date: "2026-06-18T17:00:00Z",
	message: "still making tiny launchers",
});

await repo.switchBranch("meta/minifolio", { create: true });

await repo.commit({
	message: "portfolio as a repo",
	date: "2026-06-20T17:00:00Z",
	files: {
		"projects/minifolio.md": markdown(
			"Minifolio",
			`This site.

Idea:
- a resume that can be cloned as a git repository
- a commit graph as visual biography
- real branch and merge structure
- generated JSON for the frontend
- a portfolio that rewards curiosity`,
		),
		"README.md": `# Minifolio

Cloneable portfolio. Backed by real \`git\`,
and with pseudo-accurate timelines.

This repository is also the interface:
branches are career threads, commits are milestones,
and files accrete like a resume that was lived in.
`,
	},
});

await repo.switchBranch("main");

await repo.merge("meta/minifolio", {
	date: "2026-06-21T17:00:00Z",
	message: "portfolio recursion",
});

const finalJobs = markdown(
	"Jobs",
	`## 2022 - present
- staff frontend engineer: Matera (france)
  frontend platform, type-safe APIs, design system, tooling, performance

## 2019 - 2022
- frontend developer: Mazarine (france)
  dozens of agency websites; led frontend development for www.louvre.fr

## 2015 - 2018
- doctoral student in epistemology: Jean Nicod Institute (france)
  with Emmanuel Chemla

## 2014 - 2015
- research assistant: CNRS — LSCP (france)
  with Brent Strickland

## 2014
- job: web developer for a scuba diving shop (cambodia)
- job: barista for a resort (cambodia)

## 2013
- job: sailor (panama)
- job: hiking guide (nicaragua)

## 2012 - 2013
- academia: Carnegie Mellon University — Reliable Autonomous Systems Lab (united states)
  research scholar / with Reid Simmons

## 2012
- academia: MIT Media Lab — Personal Robots (united states)
  research scholar / with Cynthia Breazeal
- academia: USC — Robotics and Autonomous Systems Center
  visiting / with Maja Matarić

## 2011
- internship: Yale University — Cognition and Development lab (united states)
  summer research intern / with Frank Keil

## 2010
- internship: home for disabled children (vietnam)
- summer job: tea farmer (vietnam)

## 2009
- summer job: grape harvest (france)

## 2008
- summer job: gardener (france)`,
);

const finalEducation = markdown(
	"Education",
	`## 2015 - 2018
- PhD / doctoral research in epistemology — Jean Nicod Institute / ENS Ulm / CNRS

## 2009 - 2012
- Masters of Engineering — ENSC

## 2007 - 2009
- classe préparatoire

## 2007
- graduated highschool`,
);

const finalTech = markdown(
	"Tech",
	`TypeScript
- library internals
- typed APIs
- code generation
- migration systems
- large monorepos

React
- SaaS product architecture
- design systems
- devtools
- TanStack Router / Start work

TanStack Router / Start
- maintainer work
- route matching rewrite
- reactive core refactor
- SSR performance
- cross-framework benchmarks

tRPC
- out-of-order streaming for batched requests
- client/server adapter work
- Node, Fastify, Fetch

React Query
- type-safe data layer
- generated query keys
- cache and invalidation architecture

Vite / build tooling
- Webpack to Vite migration
- bundle-size reduction
- module resolution
- CI performance

Static analysis / DX
- 20+ custom ESLint rules
- migration scripts
- code-health dashboards
- CLI tools

Performance
- benchmarking
- profiling
- flamegraphs
- bundle-size analysis
- SSR throughput

Next.js
- agency production websites
- personal music app
- open-source preload/prefetch fix

Prisma / PostgreSQL
- soft-serve-tunes data model

PWA / service worker / websockets
- offline-ish music app behavior
- realtime queue updates

Canvas / Web Workers / SharedArrayBuffer / WebGPU
- Vite Labs experiments
- parallel browser workloads

CSS / accessibility
- agency production sites
- louvre.fr
- design-system implementation

Vue / Svelte / Magento
- agency production websites

Node.js
- tooling
- scripts
- HTTP adapters
- Raspberry Pi hosting

R
- statistics
- experiment data analysis

Python / Bash
- robotics research scripts
- lab automation and data processing

Earlier tools
- Matlab, C++, C#, Java, Objective-C, PHP, ActionScript, Prolog`,
);

await repo.switchBranch("saas/matera");

await repo.commit({
	message: "platform has a shape now",
	date: "2026-06-22T17:00:00Z",
	files: {
		"projects/matera-platform.md": markdown(
			"Matera Frontend Platform",
			`A 1M+ LoC frontend monorepo that needed a platform reset.

Work:
- introduced TypeScript into a JavaScript codebase
- migrated Webpack to Vite
- redesigned imports and bundling
- cut initial JavaScript from 9MB to 2MB
- defined a shared type-safe data layer on React Query
- generated query keys and integrated types
- built a 40+ component design system
- built in-app devtools for forms, state machines, and navigation
- rewrote CI for parallel execution
- authored 20+ custom ESLint rules and migration scripts
- added code-health dashboards and CLI tools`,
		),
		"resume/jobs.md": finalJobs,
		"skills/tech.md": finalTech,
	},
});

await repo.switchBranch("main");

await repo.merge("saas/matera", {
	date: "2026-06-24T17:00:00Z",
	message: "merge the long branch",
	files: {
		"README.md": `# Minifolio

Cloneable portfolio. Backed by real \`git\`,
and with pseudo-accurate timelines.

Branches are career threads, commits are milestones,
and files accrete like a resume that was lived in.
`,
		"resume/jobs.md": finalJobs,
		"resume/education.md": finalEducation,
		"skills/tech.md": finalTech,
	},
});

await repo.tag("now");

await repo.finalize();
