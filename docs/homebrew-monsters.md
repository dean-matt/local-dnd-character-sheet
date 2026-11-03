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
creature type and its tags, alignment, challenge rating, every armor class with its source,
average hit points and hit dice, the five speeds, senses, languages and the six scores; the
API's reasons show beside the field. An alignment that is a range, a chance or prose, a type's
swarm size, a prose armor class, a tag with a prefix, the passive Perception score, traits and
actions stay as written and are edited in JSON. The Rules control picks the edition, and the
API refuses a repeated name within it.
