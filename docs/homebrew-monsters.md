# Homebrew monsters

A homebrew monster lives in `homebrew_monsters`. Its `json` is the 5etools bestiary entry shape,
`{name, source: "HB", size, type, ac, hp, speed, str, dex, con, int, wis, cha, cr, ...}`, the one
`monsterEntries` renders. Only those fields are required; any other field upstream writes, such as
`alignment`, `trait` or `action`, passes through untouched. `name` and `edition` are columns too, for
the unique index.

## Rules

- A monster takes an edition, `classic` or `one`, because a 2024 stat block reads it and a catalog
  monster's name recurs across editions (Goblin MM, Goblin Warrior XMM).
- A name is unique within its edition, ignoring case.
- Nothing cites a monster yet, so a delete is never refused. Companions, wild shape and familiars
  cannot draw on one.

## Reads

`/search?type=monster` returns catalog and homebrew monsters together, filtered by name, source,
edition and exclude. A homebrew hit has an `id` and no `source`, and opens at `/homebrew/monsters/{id}`
where a catalog one opens through `/catalog`. `{@creature Name|HB}` resolves to the monster.

## Editor

The Homebrew page edits a monster step by step or as JSON, and its Preview tab renders the
stat block through `monsterEntries`, as a catalog monster opens. The form sets the name, sizes,
creature type and its tags, alignment — one of the nine, unaligned, any, a range, a choice
with chances and notes, or prose, under a prefix such as `typically` — challenge rating, every
armor class with its source, average hit points and hit dice, the five speeds, senses,
languages, the six scores, its traits, actions, bonus actions, reactions, legendary actions and
mythic actions, the legendary action uses, and the text introducing the reactions, legendary
actions and mythic actions; the API's reasons show beside the field. Each of those rows is a name
and rules text of paragraphs and lists of plain items, which `{@tag}`s may fill; a row can be
moved or removed, and a list added, removed or edited an item to a line, keeping its style. A row
whose text holds a table, a nested section or a list of named items, or that is not a name and
entries, shows as read-only and is edited in JSON, as are lair actions and spellcasting blocks. A type's swarm
size, a prose armor class, a tag with a prefix and the passive Perception score stay as written
and are edited in JSON. A form edit keeps every entry it cannot show in
the place it was stored. The Rules control picks the edition, and the API refuses a repeated
name within it.
