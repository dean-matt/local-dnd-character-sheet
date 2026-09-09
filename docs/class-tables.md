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

`optionalfeatureProgression`, on 9 class and 13 subclass entries, says how many options
of a `featureType` a level knows — the count half of the join whose pool half is a
feature's own `featureType` list. It arrives in two shapes that mean different things at
a level they skip:

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

Both tables store a row per level rather than one per plateau — 391 rows where 72 would
carry the same information. That redundancy buys an absent row that means *none*, the
same reading `class_resources` and `spell_slots` already have, and a primary key that
makes two counts at one level impossible. A `(from_level, to_level)` range would be
smaller and could not assert either: SQLite has no exclusion constraint, so an overlapping
or gapped range loads clean and answers wrong.

One block carries more: Way of the Four Elements names a `required` discipline at level 3.
The count is what the table holds, so that stays in the entry's `json` — a character's
picks are not validated by the ETL.
