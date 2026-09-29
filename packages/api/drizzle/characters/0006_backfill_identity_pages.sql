-- Gives every existing character the Identity, Level, Alignment and Notes presets, after
-- its own last page. A page the user wrote under one of those slugs moves to the slug plus
-- a random suffix first, keeping its blocks, rather than turning into a preset that a
-- restore of the defaults would overwrite.
UPDATE `character_pages`
SET `slug` = `slug` || '-' || lower(hex(randomblob(4)))
WHERE `preset` = 0 AND `slug` IN ('identity', 'level', 'alignment', 'notes');
--> statement-breakpoint
INSERT INTO `character_pages` (`character_id`, `slug`, `title`, `position`, `hidden`, `preset`, `blocks`)
SELECT
	`characters`.`id`,
	`presets`.`slug`,
	`presets`.`title`,
	coalesce((SELECT max(`position`) FROM `character_pages` WHERE `character_id` = `characters`.`id`), -1) + `presets`.`offset`,
	0,
	1,
	`presets`.`blocks`
FROM `characters`
CROSS JOIN (
	SELECT 'identity' AS `slug`, 'Identity' AS `title`, 1 AS `offset`, '[{"kind":"section","section":"identity"}]' AS `blocks`
	UNION ALL SELECT 'level', 'Level', 2, '[{"kind":"section","section":"level"}]'
	UNION ALL SELECT 'alignment', 'Alignment', 3, '[{"kind":"section","section":"alignment"}]'
	UNION ALL SELECT 'notes', 'Notes', 4, '[{"kind":"section","section":"notes"}]'
) AS `presets`
WHERE NOT EXISTS (
	SELECT 1 FROM `character_pages`
	WHERE `character_id` = `characters`.`id` AND `slug` = `presets`.`slug`
);
