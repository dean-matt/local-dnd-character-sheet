CREATE TABLE `homebrew_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`hit_die` integer NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `homebrew_classes_by_name` ON `homebrew_classes` (`name`);