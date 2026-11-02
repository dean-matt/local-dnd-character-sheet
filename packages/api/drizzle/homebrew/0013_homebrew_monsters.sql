CREATE TABLE `homebrew_monsters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_monsters_by_name` ON `homebrew_monsters` ("name" COLLATE NOCASE,`edition`);