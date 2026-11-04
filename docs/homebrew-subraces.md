# Homebrew subraces

A homebrew subrace lives in `homebrew_subraces`. Its `json` is the 5etools race entry shape,
`{name, source: "HB", entries?, ...}`, holding what the subrace adds to its race, and its
parent is columns beside it: `race_id` for a homebrew race, restricted on delete, or
`race_name` and `race_source` for a catalog race.

A catalog subrace row is the race and the subrace merged by the ETL; a homebrew one is merged
over its race's row when read, by `mergeHomebrewSubrace` in `@dnd/catalog`, with the ETL's
rules. Where its increases or proficiencies cannot combine with the race's, which the ETL
refuses, its list replaces the race's.

## Rules

- A subrace takes its parent's edition. A homebrew race's edition change carries to its
  subraces in the same transaction.
- A name is unique within its parent, ignoring case: one index per kind of parent.
- Deleting a homebrew race that has subraces is refused with a 409 naming them.
- A character holds one as `subrace: {homebrewId}`, so a rename keeps it there. Deleting
  one a character holds is refused with a 409 naming the characters.
- The sheet names a held subrace from its row, and `Homebrew` once no row holds its id, when
  the derived block answers 422.

## Reads

`/races/{name}/{source}/subraces` returns the catalog and homebrew subraces together, sorted
by name. A homebrew row has an `id` and no top-level `source`, which is how a merged list
tells it from a catalog row. A homebrew race is named there by its name and source `HB`.

A `{@race}` tag naming source `HB` finds a homebrew race by name first, then a subrace by its
full name, `Elf (Moon)`, the classic row first, because a tag carries no race id.

## History

`/homebrew/subraces` joins revert and restore. A restore is refused with a 409 when the
subrace's homebrew race has since been deleted.

## Editor

The Homebrew page edits a subrace step by step or as JSON. `parent` rides in the entry as
the input names it. The Rules select picks the edition and the parent list holds that
edition's races only, so changing the edition clears the parent.
