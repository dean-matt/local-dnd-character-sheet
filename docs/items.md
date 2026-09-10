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
— 1,374 of 1,382 occurrences between them. The way out, when a character can hold one:
expand at query time from the template and the base item a character's inventory row
names, which is also how a character references a catalog row rather than copying it.

Four dangling targets survive both, all of them barding: `{@item leather barding|phb}`
and its three fellows are written as one `Barding` variant upstream renders per animal.

`rarity` spans 10 upstream values, `none`, `varies` and `unknown (magic)` among them,
and the column is nullable because 43 items carry none — though every one of those
inherits a rarity through `_copy`, so nothing is NULL at the pinned tag.
`type` is absent on 944 items and carries the 2024 `G|XPHB` form on others.

`reqAttune` is not a boolean. It is `true` 601 times, a condition such as `by a wizard`
248 more, and `optional` on 11 items that work unattuned. `requires_attunement` answers
the yes-or-no an attunement slot count needs — `optional` is a 0 — and the condition
stays in `json`, which is where a sheet reads why a character cannot attune.

`itemProperty`, `itemType` and `itemMastery` in `items-base.json` are Tier B rather than
items, and are not loaded yet: 383 `{@itemProperty}` and `{@itemMastery}` occurrences
dangle until they are. An `itemProperty` carries an `abbreviation` and no `name`, which
is the key its tag spells, so `lookups` needs a per-kind name before it can hold them.
