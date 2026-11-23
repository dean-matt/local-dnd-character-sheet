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
- Nothing reads the effect yet. The sheet still applies the recorded mechanics, and says nothing of
  the ruling.

## Editor

A catalog feature's detail on the sheet ends with a Homebrew effect section: the mechanics as
JSON, a Save button that creates or replaces the row, and a Delete button once one exists. The
section reports a problem in the JSON, or the API's reason, beside the field.
