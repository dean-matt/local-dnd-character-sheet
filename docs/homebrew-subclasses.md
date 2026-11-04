# Homebrew subclasses

A homebrew subclass lives in `homebrew_subclasses`. Its `json` is the 5etools entry shape,
`{name, source: "HB", entries?, ...}`, and its parent is columns beside it: `class_id` for a
homebrew class, restricted on delete, or `class_name` and `class_source` for a catalog class.

A read stamps `className`, `classSource` and `shortName` into `json`, so renaming a homebrew
class cannot leave an entry naming a class that is gone.

## Rules

- A subclass takes its parent's edition. A homebrew class's edition change carries to its
  subclasses in the same transaction.
- A name is unique within its parent, ignoring case: one index per kind of parent.
- Deleting a homebrew class that has subclasses is refused with a 409 naming them.
- A character holds one as `levels[].subclass: {homebrewId}`, so a rename keeps it there.
  Deleting one a character holds is refused with a 409 naming the characters.
- A held subclass grants no spells or optional features yet; the sheet names it from its
  row, and `Homebrew` once no row holds its id.

## Features

A subclass's features live in `homebrew_subclass_features`, keyed `(subclass_id, level, name)`
and deleted with the subclass. `/homebrew/subclasses/{id}/features` reads and replaces them
as `/homebrew/classes/{id}/features` does a class's, and the editor saves them there after the
row. An export carries them. The sheet lists a held subclass's features up to the
character's level in its class.

## Reads

`/classes/{name}/{source}/subclasses` returns the catalog and homebrew subclasses together,
sorted by name. A homebrew row has an `id` and no top-level `source`, which is how a merged
list tells it from a catalog row. A homebrew class is named there by its name and source `HB`.
Creation and level-up offer a homebrew class's subclasses from the level its entry's
`subclassLevel` names, and none where it names none.

A `{@subclass}` tag naming source `HB` finds a subclass by name alone, the classic row first,
because a tag carries no class.

## History

`/homebrew/subclasses` joins revert and restore, which carry its features as a class's do. A
restore is refused with a 409 when the subclass's homebrew class has since been deleted.

## Editor

The Homebrew page edits a subclass step by step or as JSON. `parent` rides in the entry as
the input names it. The Rules select picks the edition and the parent list holds that
edition's classes only, so changing the edition clears the parent.
