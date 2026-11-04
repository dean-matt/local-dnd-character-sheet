# Homebrew optional features

A homebrew optional feature lives in `homebrew_optional_features`; its types sit beside it in
`homebrew_optional_feature_types`, as `optional_feature_types` does in `content.db`. Its `json` is the
5etools optional feature shape, `{name, source: "HB", featureType, prerequisite?, entries?}`, with
`featureType` a list of the codes that offer it, such as `["EI"]`, and `prerequisite` upstream's raw
list. The edition is a column.

This is the pool half of the join in `docs/optional-features.md`. The count half, a class's or
subclass's `optionalfeatureProgression`, rides in a homebrew class's or subclass's own `json` in
upstream's shape, dense or sparse, one type to a block and each type once. A count a catalog class
states has no homebrew home, so a table cannot add an invocation to Warlock yet.

## Rules

- A name is unique within each of its feature types and its edition, ignoring case. The type table
  repeats `name` and `edition` for one unique index to say so; a write rewrites its rows in one
  transaction. The same name may recur under another type or edition.
- A type the catalog never uses is accepted and listed. Nothing checks `featureType` against
  `content.db`.
- Deleting a feature a character holds is refused with a 409 naming the characters. A character
  cites one by `{homebrewId}`, so a rename never orphans it.
- A character chooses one where it chooses a catalog feature of its type and edition, counted
  against the same entitlements; a homebrew feature entitles nothing. A homebrew class or subclass
  entitles its count at the character's level in the class, in its own row's edition, beside the
  catalog's, and the level-up dialog asks for the picks a level adds to it.

## Reads

`/search?type=optfeature&featureType=EI` returns catalog and homebrew features together. A homebrew
hit has an `id` and no `source`, and carries its prerequisites as `optionalFeature`, read the way a
catalog hit's are.

## Editor

The Homebrew page edits a feature step by step or as JSON: a name, feature types,
prerequisites and rules text, with the Rules control choosing the edition. A type is picked
from `/search/feature-types` (the catalog's types plus homebrew's, homebrew's alone before a
build), labelled by `featureTypeLabel` where it names one, or typed as a new one. The prerequisite step shows a
level (in a named class), a pact boon, spells known and options held; any other part stays
as written and is edited in JSON. A delete a character blocks lists its holders, and a name
another feature holds in a shared type is refused with the API's reason.
