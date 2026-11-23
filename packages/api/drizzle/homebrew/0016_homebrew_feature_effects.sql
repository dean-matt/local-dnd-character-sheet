CREATE TABLE `homebrew_feature_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`mechanics` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_feature_effects_by_feature` ON `homebrew_feature_effects` (`name`,`source`);