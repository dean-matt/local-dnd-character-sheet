CREATE TABLE `homebrew_subclasses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`class_id` text,
	`class_name` text,
	`class_source` text,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `homebrew_classes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_subclasses_by_homebrew_class` ON `homebrew_subclasses` (`class_id`,"name" COLLATE NOCASE) WHERE "homebrew_subclasses"."class_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_subclasses_by_catalog_class` ON `homebrew_subclasses` (`class_name`,`class_source`,"name" COLLATE NOCASE,`edition`) WHERE "homebrew_subclasses"."class_id" IS NULL;