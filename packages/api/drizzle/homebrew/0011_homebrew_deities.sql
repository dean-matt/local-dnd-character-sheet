CREATE TABLE `homebrew_deities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pantheon` text NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_deities_by_name` ON `homebrew_deities` ("name" COLLATE NOCASE,"pantheon" COLLATE NOCASE);