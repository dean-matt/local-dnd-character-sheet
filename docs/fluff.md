# Fluff

A `fluff-*.json` file carries the prose an entry's own file leaves out — `entries` and
`images` — under an array key named for the kind it describes: `raceFluff`,
`monsterFluff`, `spellFluff`. Each entry is keyed to the row it describes by `name` and
`source`, folded to lowercase the way `copy.ts` folds a `_copy` block, because upstream's
own matching folds too: five recipes' fluff spells `Eye of the Beholder` where the recipe
itself is `Eye Of The Beholder`.

`load/fluff.ts` merges a match into the row's own `json` under a `fluff` field, never
into `entries`, so the two stay tellable apart. `entities.ts` renders `fluff.entries` into
`rendered_text` beside the entry's own prose; `fluff.images` never reaches it, because a
path is not prose, and stays in `json` for whenever this project fetches the media
repository the path points into.

## The promise, not the inventory

An entry's own `hasFluff` or `hasFluffImages` is upstream's promise that a fluff entry
exists for it, and that promise is what a loader checks — not whether every fluff entry
in the file found a row. The corpus carries fluff no row will ever claim:

- Bestiary lore is written once for a species and `_copy`'d into every member, so the
  species entry itself — `Aartuks` (BAM) — names no monster and carries neither flag.
- A handful of class files carry a placeholder `subclassFluff` naming the class itself
  rather than a subclass, for the same reason.

Treating every fluff entry as a promise would fail the build on both; checking every
flagged row instead reaches the real lore without tripping on either.

## Keys narrower than `(name, source)`

A subclass's own fluff is keyed without `classSource`: the one subclass is offered under
both a class's classic and remade printings, and upstream writes its lore once rather
than under each.

A race's subrace fluff is keyed by a compound name upstream's own race fluff file writes
for one — the race's own name with the subrace's appended in parens, `Base` for the five
nameless PHB variants of Dragonborn, Half-Elf, Half-Orc, Human and Tiefling. A race that
is itself a named variant, such as `Elf (Kaladesh)`, reopens its own closing paren rather
than nesting a second: `Elf (Kaladesh; Bishatar and Tirahar)`.
