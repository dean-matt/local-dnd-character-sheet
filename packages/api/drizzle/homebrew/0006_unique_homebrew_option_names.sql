-- The same rule 0005 set for items and spells: a tag names these rows by name too, so the
-- oldest row keeps a shared name and each later row takes its id as a suffix.
UPDATE `homebrew_backgrounds`
SET `name` = `name` || ' (' || `id` || ')', `json` = json_set(`json`, '$.name', `name` || ' (' || `id` || ')')
WHERE EXISTS (
	SELECT 1 FROM `homebrew_backgrounds` AS `older`
	WHERE `older`.`name` = `homebrew_backgrounds`.`name` COLLATE NOCASE
		AND `older`.`edition` = `homebrew_backgrounds`.`edition`
		AND (`older`.`created_at`, `older`.`id`) < (`homebrew_backgrounds`.`created_at`, `homebrew_backgrounds`.`id`)
);--> statement-breakpoint
UPDATE `homebrew_classes`
SET `name` = `name` || ' (' || `id` || ')', `json` = json_set(`json`, '$.name', `name` || ' (' || `id` || ')')
WHERE EXISTS (
	SELECT 1 FROM `homebrew_classes` AS `older`
	WHERE `older`.`name` = `homebrew_classes`.`name` COLLATE NOCASE
		AND `older`.`edition` = `homebrew_classes`.`edition`
		AND (`older`.`created_at`, `older`.`id`) < (`homebrew_classes`.`created_at`, `homebrew_classes`.`id`)
);--> statement-breakpoint
UPDATE `homebrew_feats`
SET `name` = `name` || ' (' || `id` || ')', `json` = json_set(`json`, '$.name', `name` || ' (' || `id` || ')')
WHERE EXISTS (
	SELECT 1 FROM `homebrew_feats` AS `older`
	WHERE `older`.`name` = `homebrew_feats`.`name` COLLATE NOCASE
		AND `older`.`edition` = `homebrew_feats`.`edition`
		AND (`older`.`created_at`, `older`.`id`) < (`homebrew_feats`.`created_at`, `homebrew_feats`.`id`)
);--> statement-breakpoint
UPDATE `homebrew_races`
SET `name` = `name` || ' (' || `id` || ')', `json` = json_set(`json`, '$.name', `name` || ' (' || `id` || ')')
WHERE EXISTS (
	SELECT 1 FROM `homebrew_races` AS `older`
	WHERE `older`.`name` = `homebrew_races`.`name` COLLATE NOCASE
		AND `older`.`edition` = `homebrew_races`.`edition`
		AND (`older`.`created_at`, `older`.`id`) < (`homebrew_races`.`created_at`, `homebrew_races`.`id`)
);--> statement-breakpoint
DROP INDEX `homebrew_backgrounds_by_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_backgrounds_by_name` ON `homebrew_backgrounds` ("name" COLLATE NOCASE,`edition`);--> statement-breakpoint
DROP INDEX `homebrew_classes_by_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_classes_by_name` ON `homebrew_classes` ("name" COLLATE NOCASE,`edition`);--> statement-breakpoint
DROP INDEX `homebrew_feats_by_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_feats_by_name` ON `homebrew_feats` ("name" COLLATE NOCASE,`edition`);--> statement-breakpoint
DROP INDEX `homebrew_races_by_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_races_by_name` ON `homebrew_races` ("name" COLLATE NOCASE,`edition`);
