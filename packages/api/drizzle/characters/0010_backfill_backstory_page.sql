-- Gives every existing character the Backstory preset just before its Notes preset, where a
-- new character has it. A page the user wrote under `backstory` moves to the slug plus a
-- random suffix first, keeping its blocks. Notes and every page after it move down one, in
-- two passes through negative positions, because `character_pages_by_position` checks each
-- row as it changes and a single `position + 1` collides with the next page. Notes' position
-- is read once into a temporary table, since the first pass moves the row it is read from.
UPDATE `character_pages`
SET `slug` = `slug` || '-' || lower(hex(randomblob(4)))
WHERE `preset` = 0 AND `slug` = 'backstory';
--> statement-breakpoint
CREATE TEMP TABLE `backstory_slot` AS
SELECT `character_id`, `position` FROM `character_pages`
WHERE `slug` = 'notes' AND `preset` = 1
	AND `character_id` NOT IN (SELECT `character_id` FROM `character_pages` WHERE `slug` = 'backstory');
--> statement-breakpoint
UPDATE `character_pages`
SET `position` = -`position` - 1
WHERE `position` >= (
	SELECT `position` FROM `backstory_slot` WHERE `character_id` = `character_pages`.`character_id`
);
--> statement-breakpoint
UPDATE `character_pages` SET `position` = -`position` WHERE `position` < 0;
--> statement-breakpoint
INSERT INTO `character_pages` (`character_id`, `slug`, `title`, `position`, `hidden`, `preset`, `blocks`)
SELECT
	`characters`.`id`,
	'backstory',
	'Backstory',
	coalesce(
		(SELECT `position` FROM `backstory_slot` WHERE `character_id` = `characters`.`id`),
		(SELECT max(`position`) + 1 FROM `character_pages` WHERE `character_id` = `characters`.`id`),
		0
	),
	0,
	1,
	'[{"kind":"section","section":"backstory"}]'
FROM `characters`
WHERE NOT EXISTS (
	SELECT 1 FROM `character_pages`
	WHERE `character_id` = `characters`.`id` AND `slug` = 'backstory'
);
--> statement-breakpoint
DROP TABLE `backstory_slot`;
