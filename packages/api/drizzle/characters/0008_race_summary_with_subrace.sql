-- Rewrites each stored `race_summary` in the shape `raceSummary` writes, `Elf (High)`
-- rather than `High`. A character with no subrace already holds that shape. `Homebrew`
-- names a race with no name, as `displayName` reads a `homebrewId`.
UPDATE `characters`
SET `race_summary` = coalesce(json_extract(`definition`, '$.race.name'), 'Homebrew')
	|| ' (' || json_extract(`definition`, '$.subrace.name') || ')'
WHERE json_extract(`definition`, '$.subrace.name') IS NOT NULL;
