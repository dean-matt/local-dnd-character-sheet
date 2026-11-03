# Homebrew deities

A homebrew deity lives in `homebrew_deities`. Its `json` is the 5etools deity entry shape,
`{name, source: "HB", pantheon, alignment?, domains?, title?, entries?}`, with `alignment` as
upstream's letters, such as `["N", "G"]`. `name` and `pantheon` are columns too, for the unique
index.

A deity has no edition: a catalog deity's is NULL, and so is a homebrew one's, in a search hit
and nowhere else.

## Rules

- A name is unique within its pantheon, ignoring case. The same name may recur across
  pantheons, as `Oghma` does in the catalog.
- A character cites a deity by `(name, "HB", pantheon)`, never by id. Deleting one a
  character holds is refused with a 409 naming the characters. So is changing its name or
  pantheon, since the holders match on that key; any other field saves freely.
- `/character/{id}/references` leaves an `HB` deity alone, as it does an `HB` skill: the
  routes above keep the citation from orphaning.

## Reads

`/search` merges homebrew deities with the catalog's: a hit with an `id`, no `source`, and the
pantheon as `qualifier`. `{@deity name|HB|pantheon}` resolves to the deity, the first by
pantheon where the tag names none.

The deity picker, in creation and on Identity, offers these hits beside the catalog's and
stores the `(name, "HB", pantheon)` citation. Identity tags a cited deity that
`/homebrew/deities` lacks `Not found in homebrew`.

## Editor

The Homebrew page edits a deity step by step or as JSON, with no Rules control, since a
deity has no edition and its entry carries none. Alignment is picked as upstream's letters,
domains typed comma-separated. A delete or a name or pantheon change a character blocks
shows the API's reason: the delete dialog links each holder, the save footer prints the
refusal.
