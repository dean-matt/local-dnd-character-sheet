-- A tag names a homebrew row by name, so a name is unique within an edition, ignoring case.
-- Rows already sharing one keep the oldest under that name; each later row takes its id
-- as a suffix, which leaves every character reference intact because characters hold ids.
UPDATE `homebrew_items`
SET `name` = `name` || ' (' || `id` || ')', `json` = json_set(`json`, '$.name', `name` || ' (' || `id` || ')')
WHERE EXISTS (
	SELECT 1 FROM `homebrew_items` AS `older`
	WHERE `older`.`name` = `homebrew_items`.`name` COLLATE NOCASE
		AND `older`.`edition` = `homebrew_items`.`edition`
		AND (`older`.`created_at`, `older`.`id`) < (`homebrew_items`.`created_at`, `homebrew_items`.`id`)
);--> statement-breakpoint
UPDATE `homebrew_spells`
SET `name` = `name` || ' (' || `id` || ')', `json` = json_set(`json`, '$.name', `name` || ' (' || `id` || ')')
WHERE EXISTS (
	SELECT 1 FROM `homebrew_spells` AS `older`
	WHERE `older`.`name` = `homebrew_spells`.`name` COLLATE NOCASE
		AND `older`.`edition` = `homebrew_spells`.`edition`
		AND (`older`.`created_at`, `older`.`id`) < (`homebrew_spells`.`created_at`, `homebrew_spells`.`id`)
);--> statement-breakpoint
DROP INDEX `homebrew_items_by_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_items_by_name` ON `homebrew_items` ("name" COLLATE NOCASE,`edition`);--> statement-breakpoint
DROP INDEX `homebrew_spells_by_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `homebrew_spells_by_name` ON `homebrew_spells` ("name" COLLATE NOCASE,`edition`);
