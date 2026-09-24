-- A character can predate the preset pages every new one is seeded with; this gives each
-- one still missing them the same rows `PRESET_PAGES` seeds.
INSERT INTO `character_pages` (`character_id`, `slug`, `title`, `position`, `hidden`, `preset`, `blocks`)
SELECT `characters`.`id`, `presets`.`slug`, `presets`.`title`, `presets`.`position`, 0, 1, `presets`.`blocks`
FROM `characters`
CROSS JOIN (
	SELECT 'stats' AS `slug`, 'Stats' AS `title`, 0 AS `position`, '[{"kind":"section","section":"abilities"}]' AS `blocks`
	UNION ALL SELECT 'spells', 'Spells', 1, '[{"kind":"section","section":"spells"}]'
	UNION ALL SELECT 'inventory', 'Inventory', 2, '[{"kind":"section","section":"inventory"}]'
	UNION ALL SELECT 'features', 'Features', 3, '[{"kind":"section","section":"features"}]'
) AS `presets`
WHERE `characters`.`id` NOT IN (SELECT `character_id` FROM `character_pages`);
