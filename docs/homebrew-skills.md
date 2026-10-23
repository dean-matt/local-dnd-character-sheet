# Homebrew skills

A table defines a skill once in Settings › Homebrew › Skills, and a character or an item
cites it. A row's `json` is a `lookups` skill row, `{name, source: "HB", ability, entries?}`,
keyed `(name, source)` and unique by name within an edition, like every homebrew row.

## How a character holds one

A character holds a homebrew skill as a `proficiencies.skills` entry whose `ref` has source
`HB`, added from the skills block at level `none`. The entry stays at `none`, where a
built-in skill's entry is dropped, because the entry is the character's only record that it
holds the skill. The derived block lists a homebrew skill only for a character holding one,
in the character's edition, so the sheet's skill list is the built-in skills plus the
character's own.

A character's `customSkills` stay a per-character option beside these. They suit a skill
one character plays, and moving them would rewrite every stored definition for no change in
what a sheet shows.

## How an item names one

An item's advantage effect names the skill in `target`, the way it names a built-in skill:
`itemAdvantageSchema` reads any string there, and the sheet matches it to the row by name.

## Rename and delete

Both citations are by name, so the skill routes refuse a rename, a move to another edition
or a delete while a character or an item of that edition holds the skill, and the 409 names
each. Nothing checks a homebrew
name against the built-in skills, so a homebrew skill named for one gives both rows the
same effects.
