-- This table plays every classic character with a long rest that returns every hit die, so
-- each classic definition, and each one an undo entry holds, stores the option as on. One
-- already set stays as the user chose it; an absent option still means the rule as printed.
UPDATE `characters`
SET `definition` = json_set(`definition`, '$.houseRules.everyHitDieOnLongRest', json('true'))
WHERE json_extract(`definition`, '$.edition') = 'classic'
	AND json_type(`definition`, '$.houseRules.everyHitDieOnLongRest') IS NULL;
--> statement-breakpoint
UPDATE `undo_log`
SET `previous_state` = json_set(`previous_state`, '$.houseRules.everyHitDieOnLongRest', json('true'))
WHERE json_extract(`previous_state`, '$.edition') = 'classic'
	AND json_type(`previous_state`, '$.houseRules.everyHitDieOnLongRest') IS NULL;
