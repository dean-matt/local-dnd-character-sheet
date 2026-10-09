-- Rewrites each stored `race_summary` in the shape `raceSummary` writes, `Elf (High)`
-- rather than `High`. A character with no subrace already holds that shape. A homebrew
-- race has no name, so it reads `Homebrew`, as `displayName` gives it.
UPDATE `characters`
SET `race_summary` = coalesce(json_extract(`definition`, '$.race.name'), 'Homebrew')
	|| ' (' || json_extract(`definition`, '$.subrace.name') || ')'
WHERE json_extract(`definition`, '$.subrace.name') IS NOT NULL;
