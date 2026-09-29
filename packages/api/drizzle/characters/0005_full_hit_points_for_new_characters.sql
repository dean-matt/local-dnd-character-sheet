-- Every state row written before `hitPoints.current` could be null started at 0, and
-- nothing in the sheet writes hit points yet, so a 0 here is that default rather than a
-- character dropped to 0. A 0 set by hand through `PUT /characters/{id}/state` reads as
-- full afterwards; setting it again restores it.
UPDATE `character_state`
SET `state` = json_set(`state`, '$.hitPoints.current', json('null'))
WHERE json_extract(`state`, '$.hitPoints.current') = 0;
