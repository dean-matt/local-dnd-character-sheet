-- The default is a placeholder for a character that predates these columns, not a value
-- the application ever writes: `insertCharacter` and `updateCharacterDefinition` always
-- pass a computed `race_summary` and `class_summary`, so a character saved after this
-- migration never reads the default, and one saved before it recomputes on its next edit.
ALTER TABLE `characters` ADD `race_summary` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `characters` ADD `class_summary` text NOT NULL DEFAULT '';
