CREATE TABLE `github_snapshots` (
	`resource` text NOT NULL,
	`login` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `github_snapshots_pk` PRIMARY KEY(`resource`, `login`),
	CONSTRAINT "github_snapshots_resource_check" CHECK("resource" in ('contributions', 'repositories'))
);
--> statement-breakpoint
CREATE TABLE `github_windows` (
	`resource` text NOT NULL,
	`login` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`state` text NOT NULL,
	`payload` text,
	`expires_at` integer NOT NULL,
	CONSTRAINT `github_windows_pk` PRIMARY KEY(`resource`, `login`, `from_date`, `to_date`),
	CONSTRAINT "github_windows_resource_check" CHECK("resource" in ('contributions', 'repositories')),
	CONSTRAINT "github_windows_state_check" CHECK("state" in ('ready', 'split'))
);
