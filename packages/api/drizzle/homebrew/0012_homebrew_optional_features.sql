CREATE TABLE `homebrew_optional_feature_types` (
	`feature_id` text NOT NULL,
	`feature_type` text NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	PRIMARY KEY(`feature_id`, `feature_type`),
	FOREIGN KEY (`feature_id`) REFERENCES `homebrew_optional_features`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_optional_feature_types_by_name` ON `homebrew_optional_feature_types` (`feature_type`,`edition`,"name" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `homebrew_optional_features` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`edition` text NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
