# Homebrew feature effects

A table's ruling on a catalog feature's mechanics lives in `homebrew_feature_effects`, one row per
feature, keyed `(name, source)` and written through `/homebrew/feature-effects`. The row holds a
`mechanics` list in the vocabulary of `featureMechanicRecords.ts`, and a write refuses a list
`mechanicListSchema` rejects, as it does for a homebrew feat's.

## Rules

- A feature has at most one effect; a second write for the same `(name, source)` is a 409 carrying
  the row that holds it. A class or subclass feature is keyed by its name and source alone, so one
  that several classes share, such as `Ability Score Improvement`, takes one effect for all of them.
- Deleting the effect removes its row; nothing else references it.
- The effect replaces the feature's recorded mechanics wherever a character holds the feature, and
  deleting it restores them. A catalog feat or optional feature with no recorded mechanics takes the
  effect too; a class feature or racial trait with none does not, since the sheet knows it is held
  only through its record.
- The derived block's `homebrewEffects` lists each held feature the effect replaces, and the
  feature's row on the sheet carries a Homebrew effect chip.

## Editor

A catalog feature's detail on the sheet ends with a Homebrew effect section: the mechanics as
JSON, a Save button that creates or replaces the row, and a Delete button once one exists. The
section reports a problem in the JSON, or the API's reason, beside the field.
