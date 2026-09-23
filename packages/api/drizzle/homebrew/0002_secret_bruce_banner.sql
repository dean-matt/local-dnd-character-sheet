CREATE TABLE `homebrew_feats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `homebrew_feats_by_name` ON `homebrew_feats` (`name`);