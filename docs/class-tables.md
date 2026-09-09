# Class tables

How upstream states what a class gets at each level, and what the ETL can and cannot
take from it. The tables themselves are in `packages/content/src/schema.ts` and the
loader is `packages/content/src/load/classes.ts`.

## Class resources

`classTableGroups` on a class entry is structured and indexed by level:

```
Barbarian  colLabels ["Rages", "Rage Damage"]   rows [["2", +2], ["2", +2], ["3", +2]]
Monk       colLabels ["Martial Arts", "Ki Points", "Unarmored Movement"]
Sorcerer   colLabels ["Sorcery Points"]
           rowsSpellProgression [[2,0,0,...], [3,0,...], [4,2,0,...]]
```

**Spell slots come free** via `rowsSpellProgression` — there is no need to hardcode the
slot table for any full or half caster.

Column labels are human strings, so the ETL needs a `colLabel -> resource key` map. Of
the 130 distinct labels, 109 are `{@filter}` links to a 5etools spell or optional-feature
list and two are `{@tip}` tags; reduced to display text they collapse to 33. Twelve of
those arrive only as markup, and the remaining 21 are plain prose:

```
Rages · Rage Damage · Ki Points · Focus Points · Sorcery Points · Channel Divinity
Martial Arts · Bardic Die · Second Wind · Sneak Attack · Wild Shape · Weapon Mastery
Unarmored Movement · Infused Items · Favored Enemy · Psi Points · Psi Limit
Spell Slots · Slot Level · Plans Known · Magic Items
```

Four traps in reading a group:

- **Only 6 of 322 subclasses have `subclassTableGroups`** — Eldritch Knight and Arcane
  Trickster spell progression, plus Psi Warrior and Soulknife energy dice. Battle Master
  superiority dice live in feature prose and are not extractable. Each such group repeats
  its own subclass in a `subclasses` list, and all 10 name only their owner.
- **Warlock pact magic** uses separate `Spell Slots` and `Slot Level` columns instead of
  `rowsSpellProgression`. The slot level reads as `1st` in `PHB` and as `1` in `XPHB`.
- **Psi Warrior and Soulknife labels are `{@tip ...}` tags**, not plain strings.
- **A cell is not always a number**: `{"type": "bonus"}`, `{"type": "bonusSpeed"}` and
  `{"type": "dice"}` objects appear alongside counts, `{@dice D8}` markup, an em dash for
  a resource the level has not reached, and `Unlimited` for a level 20 barbarian's rages.

## Optional features per level

`optionalfeatureProgression` — 9 blocks over 8 class entries, the `PHB` warlock carrying
two, and 13 over 13 subclass entries — says how many options of a `featureType` a level
knows. It is the count half of the join whose pool half is a feature's own `featureType`
list. On a class or subclass it arrives in two shapes that mean different things at a
level they skip:

```
Warlock   progression [1,3,3,3,5,5,6,...]   20 cells, one per level
Sorcerer  progression {"3":2,"10":3,"17":4} the levels it changes at, and silent between
```

19 of the 22 blocks are the sparse object, which **carries its count forward**: a level 9
sorcerer knows the 2 kinds of metamagic it took at 3. Read as though it were dense, it
files a count at three levels and loses the other 15; a dense array read as sparse loses
every level. Both are normalized to a row per level.

`known` is the running total at that level, not the options gained there — a level 2
`XPHB` warlock knows 3 invocations, having gained 2. What a level adds is the difference
from the level below.

It is also a total per block, not per character: a class and its subclass can both offer
the same type, and a character gets the sum. A level 10 `PHB` Champion knows two fighting
styles — one from the Fighter row at level 1, one from the Champion row at level 10 — so a
query reading either table alone is short by the other.

Both tables store a row per level rather than one per plateau — 391 rows where 72 would
carry the same information. That redundancy buys an absent row that means *none*, the
same reading `class_resources` and `spell_slots` already have, and a primary key that
makes two counts at one level impossible. A `(from_level, to_level)` range would be
smaller and could not assert either: SQLite has no exclusion constraint, so an overlapping
or gapped range loads clean and answers wrong.

A third shape exists, on entries these tables do not cover. Four feats and one optional
feature key a progression `*` — Martial Adept grants 2 maneuvers, Metamagic Adept 2
metamagics — because a feat has no level to hang a count on. `character-options.ts` does
not read `optionalfeatureProgression`, so feat-granted options are absent from the catalog
as counts and a class-side query cannot see them. The loader here refuses a `*` by name
rather than coercing it, so the day upstream moves such a block onto a class, the build
says which shape it found.

Two upstream fields state the invocation and infusion counts, so two tables hold them:
`class_resources.invocations_known` and `infusions_known` come from a `colLabels` column,
and `class_optional_features.known` from `optionalfeatureProgression`. They agree cell for
cell at the pinned tag and nothing asserts they will — a check would need a hand-kept map
from type code to resource key, which is the list `edition.ts` warns about. The typed row
is the one to join, because it carries the `featureType` that reaches the pool; the
resource row is a number to print on a sheet.

The subclass table's key includes `subclass_source`, and a class offers both editions of a
subclass, so `Fighter|XPHB` holds `Battle Master|PHB` and `Battle Master|XPHB` — 5
maneuvers each at level 7. Fixing class, level and type returns two rows there. A query
filters `subclass_source`, or joins `subclasses` for the subclass's own edition, which is
the row's edition and never the class's.

One block carries more: Way of the Four Elements names a `required` discipline at level 3.
The count is what the table holds, so that stays in the entry's `json` — a character's
picks are not validated by the ETL.
