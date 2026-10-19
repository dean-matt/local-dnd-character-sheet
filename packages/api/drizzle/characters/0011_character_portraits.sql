CREATE TABLE `character_portraits` (
	`character_id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`image` blob NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `characters` ADD `portrait_updated_at` integer;