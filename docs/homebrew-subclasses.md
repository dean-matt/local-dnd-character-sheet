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
- A character cannot hold a homebrew subclass yet, so nothing else references one.

## Reads

`/classes/{name}/{source}/subclasses` returns the catalog and homebrew subclasses together,
sorted by name. A homebrew row has an `id` and no top-level `source`, which is how a merged
list tells it from a catalog row. A homebrew class is named there by its name and source `HB`.

A `{@subclass}` tag naming source `HB` finds a subclass by name alone, the classic row first,
because a tag carries no class.

## History

`/homebrew/subclasses` joins revert and restore. A restore is refused with a 409 when the
subclass's homebrew class has since been deleted.
