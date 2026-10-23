CREATE TABLE `homebrew_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_skills_by_name` ON `homebrew_skills` ("name" COLLATE NOCASE,`edition`);