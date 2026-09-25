# Items

Three files and four array keys land in the one `items` table, keyed `(name, source)`.
No key collides with another, which is what lets a `{@item}` tag resolve in one lookup
without saying which array it meant. `kind` records the array, because two of the four
are not things a character owns:

```
items.json         item          2428    the magic items, 53 _copy
                   itemGroup      109    the entry a family of items is written under
items-base.json    baseitem       230    ordinary equipment, 176 declaring an edition
magicvariants.json magicvariant   214    templates upstream expands against base items
```

A magic variant states the item's own fields under `inherits` — the entry around it is
the template's match rules — so its source, rarity and attunement come from there. Its
own `type` is a `GV|` generic-variant code that `kind` already says, and is not stored.

**The expansions are absent.** `+1 Chain Mail` and `Longsword of Cold Resistance` exist
in no upstream file: they come of applying a template to every base item its `requires`
matches. Storing them means 6,155 synthesized rows, 3,634 distinct — the same expanded
name arrives from a `PHB` and an `XPHB` base item, so 2,521 collide on `(name, source)`
and the key would have to widen to carry the base item. Templates alone resolve 173 of
the 361 `{@item}` targets that would otherwise dangle, and the expansions another 185
— 1,374 of 1,382 occurrences between them.

A character holds one by naming both: an inventory entry's `ref` is the base item and its
`variant` the `magicvariant`, the same way a reference names a catalog row rather than
copying it. `GET /items/{name}/{source}/variants/{variantName}/{variantSource}`
(`packages/api/src/db/queries/item-variant.ts`) expands the pair at read time — the
variant's `inherits` fields over the base item's own — rather than storing the result, so
a `content.db` rebuild still updates every character. A base item the variant's `requires`
or `excludes` refuses is a 409, not an expanded item the rules do not allow.

Four dangling targets survive both, all of them barding: `{@item leather barding|phb}`
and its three fellows are written as one `Barding` variant upstream renders per animal.

`rarity` spans 10 upstream values, `none`, `varies` and `unknown (magic)` among them,
and the column is nullable because 43 items carry none — though every one of those
inherits a rarity through `_copy`, so nothing is NULL at the pinned tag.
`type` is absent on 944 items and carries the 2024 `G|XPHB` form on others.

**`weight` stays in `json` rather than becoming a column.** It is pounds, a plain
number, so a column would project it unchanged — where a magic variant hides `type` and
`rarity` under `inherits`, and `requires_attunement` folds three `reqAttune` shapes into
a flag. Only `Barding` touches weight, as the expression `[[baseItem.weight]] * 2` the
read-time expansion evaluates, so a sheet keys an entry's weight by its base item and
variant together. `json_extract(json, '$.weight')` reads every row that carries one,
nothing filters or sorts on it, and a column would cost a full `content.db` rebuild for
a value already there. 888 of the 2,428 items and 216 of the 230 base items carry a
weight, the `_copy` items among them inheriting theirs; the rest state none and weigh
nothing to a character. The way out, the day a sum over a whole pack wants an index: the
column is a rebuild rather than a migration, which this table takes wholesale anyway.

`reqAttune` is not a boolean. It is `true` 601 times, a condition such as `by a wizard`
248 more, and `optional` on 11 items that work unattuned. `requires_attunement` answers
the yes-or-no an attunement slot count needs — `optional` is a 0 — and the condition
stays in `json`, which is where a sheet reads why a character cannot attune.

## The five arrays in `items-base.json` that are not items

They are Tier B, so they land in `lookups` beside the conditions and the skills:

```
itemProperty                26   keyed by abbreviation, only one carrying a name
itemType                    67   name and abbreviation both, 2 _copy
itemMastery                  8   the 2024 weapon masteries the classes reference
itemEntry                   13   an entriesTemplate an item expands into its own text
itemTypeAdditionalEntries    2   entries appended to every item of a type
```

**A property and a type are named in `lookups` by their abbreviation**, because that is
what a reference spells: `{@itemProperty 2H|XPHB}`, and an item's `type` reads `M|XPHB`.
Only one of the 26 properties carries a `name` at all, and it writes `special` — the
lowercase word an item's line renders rather than a title — so reading `name` where it
exists would key that one differently from the rest. The human label a type also carries
stays in `json`, which is where a picker listing types reads it. `load/lookups.ts` states
the rule once, as `qualifier` already does for a deity's pantheon.

An `itemType` `_copy` names its parent by abbreviation too, which `copy.ts` needs no
telling: a block's identity is whatever fields it lists.

382 of the 383 `{@itemProperty}` and `{@itemMastery}` occurrences now resolve. The last
is `{@itemProperty 2h|XPHB|Two-Handed}`, spelling the abbreviation in lowercase. A row
keeps the spelling upstream gave it, so a case-folding resolve in the renderer is what
closes that one — safe here, because no two abbreviations collide once case is folded.

**`itemEntry` and `itemTypeAdditionalEntries` are loaded although no `{@tag}` reaches
them.** An item's rendered text needs both: `items.json` and `magicvariants.json` carry
122 `{#itemEntry Name|SOURCE}` references, and the two additional-entry rows attach to
every item whose type their `appliesTo` names. Expanding either into an item's text is
the renderer's half; the rows are here so that half is a query rather than a second ETL
change.
