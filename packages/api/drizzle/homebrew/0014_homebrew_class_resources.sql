CREATE TABLE `homebrew_class_resources` (
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`resets` text,
	`maximums` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `homebrew_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_class_resources_by_name` ON `homebrew_class_resources` (`class_id`,"name" COLLATE NOCASE);