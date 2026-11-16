-- Gives every existing character the Combat preset just after its Stats preset, where a new
-- character has it, or first when it has no Stats preset. A page the user wrote under
-- `combat` moves to the slug plus a random suffix first, keeping its blocks. Every page from
-- that slot on moves down one, in two passes through negative positions, because
-- `character_pages_by_position` checks each row as it changes and a single `position + 1`
-- collides with the next page. The slot is read once into a temporary table, since the first
-- pass moves the row it is read from.
UPDATE `character_pages`
SET `slug` = `slug` || '-' || lower(hex(randomblob(4)))
WHERE `preset` = 0 AND `slug` = 'combat';
--> statement-breakpoint
CREATE TEMP TABLE `combat_slot` AS
SELECT
	`characters`.`id` AS `character_id`,
	coalesce(
		(SELECT `position` + 1 FROM `character_pages`
			WHERE `character_id` = `characters`.`id` AND `slug` = 'stats' AND `preset` = 1),
		0
	) AS `position`
FROM `characters`
WHERE `characters`.`id` NOT IN (SELECT `character_id` FROM `character_pages` WHERE `slug` = 'combat');
--> statement-breakpoint
UPDATE `character_pages`
SET `position` = -`position` - 1
WHERE `character_id` IN (SELECT `character_id` FROM `combat_slot`)
	AND `position` >= (
		SELECT `position` FROM `combat_slot` WHERE `character_id` = `character_pages`.`character_id`
	);
--> statement-breakpoint
UPDATE `character_pages` SET `position` = -`position` WHERE `position` < 0;
--> statement-breakpoint
INSERT INTO `character_pages` (`character_id`, `slug`, `title`, `position`, `hidden`, `preset`, `blocks`)
SELECT `character_id`, 'combat', 'Combat', `position`, 0, 1, '[{"kind":"section","section":"combat"}]'
FROM `combat_slot`;
--> statement-breakpoint
DROP TABLE `combat_slot`;
