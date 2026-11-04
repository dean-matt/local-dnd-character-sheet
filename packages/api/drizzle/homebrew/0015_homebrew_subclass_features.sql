CREATE TABLE `homebrew_subclass_features` (
	`subclass_id` text NOT NULL,
	`name` text NOT NULL,
	`level` integer NOT NULL,
	`entries` text NOT NULL,
	PRIMARY KEY(`subclass_id`, `level`, `name`),
	FOREIGN KEY (`subclass_id`) REFERENCES `homebrew_subclasses`(`id`) ON UPDATE no action ON DELETE cascade
);
