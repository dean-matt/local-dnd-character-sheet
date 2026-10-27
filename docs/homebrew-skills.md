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

## Ability and flat forms

A skill's `ability` is one of the six abilities, or `flat`, a skill with no ability whose
number each holding character sets itself. A flat skill's number lives on the character's
`proficiencies.skills` entry as `flat`, beside its level; a missing number reads as 0, and
the modifier is that number plus the proficiency bonus the level gives. Only homebrew carries
`flat`, so `skillEntrySchema` keeps the ability enum 5etools prints and
`homebrewSkillEntrySchema` adds it.

A character picks its homebrew skills from the Skills card's Add skill button, which searches the
skills of its edition it does not hold yet. The card never makes one, so a table's skill list holds
only what Settings defined. There is no second kind of skill.

While any character holds a skill, its form cannot switch between an ability and `flat`;
Settings disables the select and names the holders.

## One name per skill

A skill's name is unique within an edition, compared without regard to case, across the
catalog's skills and the homebrew skills. The sheet and the API refuse a name either holds. A
homebrew skill that already carries a catalog name keeps it and is not refused on edit.

## Numbered renames

Converting a character's older `customSkills` into homebrew skills follows fixed rules, within one
edition and without regard to case. Skills of one name and form merge into one row. Where one name
carries different forms, an existing homebrew skill of that name keeps the plain name; otherwise
the first form (STR to CHA, then flat) does, and each other form takes ` (2)`, ` (3)` on,
passing over a name already taken. A name a catalog skill holds is suffixed in every form. The
rules live in `packages/character/src/convertCustomSkills.ts`. The API runs them at start and on
importing a character file exported before the change.

A roll-log label citing a renamed skill, "<name> check", follows the rename on that character; where
one character held two forms of the same name, the label follows the first.

## How an item names one

An item's advantage effect names the skill in `target`, the way it names a built-in skill:
`itemAdvantageSchema` reads any string there, and the sheet matches it to the row by name.

## Rename and delete

Both citations are by name, so the skill routes refuse a rename, a move to another edition
or a delete while a character or an item of that edition holds the skill, and the 409 names
each.

Nothing checks a homebrew name against the built-in skills, so a homebrew skill named for
one gives both rows the same effects.
