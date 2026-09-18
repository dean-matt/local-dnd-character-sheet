CREATE TABLE `homebrew_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`type` text,
	`rarity` text,
	`requires_attunement` integer DEFAULT false NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `homebrew_items_by_name` ON `homebrew_items` (`name`);--> statement-breakpoint
CREATE TABLE `homebrew_spells` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`level` integer NOT NULL,
	`school` text NOT NULL,
	`concentration` integer DEFAULT false NOT NULL,
	`ritual` integer DEFAULT false NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `homebrew_spells_by_name` ON `homebrew_spells` (`name`);