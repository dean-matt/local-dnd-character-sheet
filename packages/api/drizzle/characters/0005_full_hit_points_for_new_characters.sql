-- Every state row written before `hitPoints.current` could be null started at 0, and
-- nothing in the sheet writes hit points yet, so a 0 here is that default rather than a
-- character dropped to 0. A row with a death save rolled is dying and keeps its 0; a 0 set
-- by hand through `PUT /characters/{id}/state` with none reads as full afterwards.
UPDATE `character_state`
SET `state` = json_set(`state`, '$.hitPoints.current', json('null'))
WHERE json_extract(`state`, '$.hitPoints.current') = 0
  AND json_extract(`state`, '$.deathSaves.successes') = 0
  AND json_extract(`state`, '$.deathSaves.failures') = 0;
