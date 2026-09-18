-- A character can predate the row `character_state` now gives every new one; this gives
-- each one still missing it the same default `defaultCharacterState()` writes.
INSERT INTO `character_state` (`character_id`, `state`)
SELECT `id`, '{"hitPoints":{"current":0,"temporary":0},"hitDice":[],"spellSlots":[],"pactSlots":null,"conditions":[],"resources":[],"deathSaves":{"successes":0,"failures":0},"exhaustion":0}'
FROM `characters`
WHERE `id` NOT IN (SELECT `character_id` FROM `character_state`);
