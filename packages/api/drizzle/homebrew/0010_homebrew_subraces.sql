CREATE TABLE `homebrew_subraces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`race_id` text,
	`race_name` text,
	`race_source` text,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`race_id`) REFERENCES `homebrew_races`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_subraces_by_homebrew_race` ON `homebrew_subraces` (`race_id`,"name" COLLATE NOCASE) WHERE "homebrew_subraces"."race_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_subraces_by_catalog_race` ON `homebrew_subraces` (`race_name`,`race_source`,"name" COLLATE NOCASE,`edition`) WHERE "homebrew_subraces"."race_id" IS NULL;