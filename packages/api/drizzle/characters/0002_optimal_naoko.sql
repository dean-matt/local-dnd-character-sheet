CREATE TABLE `character_pages` (
	`character_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`preset` integer DEFAULT false NOT NULL,
	`blocks` text NOT NULL,
	PRIMARY KEY(`character_id`, `slug`),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_pages_by_position` ON `character_pages` (`character_id`,`position`);