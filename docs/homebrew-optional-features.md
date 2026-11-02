# Homebrew optional features

A homebrew optional feature lives in `homebrew_optional_features`; its types sit beside it in
`homebrew_optional_feature_types`, as `optional_feature_types` does in `content.db`. Its `json` is the
5etools optional feature shape, `{name, source: "HB", featureType, prerequisite?, entries?}`, with
`featureType` a list of the codes that offer it, such as `["EI"]`, and `prerequisite` upstream's raw
list. The edition is a column.

This is the pool half of the join in `docs/optional-features.md`. The count half, a class's or
subclass's `optionalfeatureProgression`, has no homebrew table, so a homebrew class cannot grant one
and a table cannot add an invocation to Warlock yet.

## Rules

- A name is unique within each of its feature types and its edition, ignoring case. The type table
  repeats `name` and `edition` for one unique index to say so; a write rewrites its rows in one
  transaction. The same name may recur under another type or edition.
- A type the catalog never uses is accepted and listed. Nothing checks `featureType` against
  `content.db`.
- Deleting a feature a character holds is refused with a 409 naming the characters. A character
  cites one by `{homebrewId}`, so a rename never orphans it.
- A character cannot choose one yet: the pickers list it as unavailable, and it entitles nothing.

## Reads

`/search?type=optfeature&featureType=EI` returns catalog and homebrew features together. A homebrew
hit has an `id` and no `source`, and carries its prerequisites as `optionalFeature`, read the way a
catalog hit's are.
