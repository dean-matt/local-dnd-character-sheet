CREATE TABLE `homebrew_class_features` (
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`level` integer NOT NULL,
	`entries` text NOT NULL,
	PRIMARY KEY(`class_id`, `level`, `name`),
	FOREIGN KEY (`class_id`) REFERENCES `homebrew_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
