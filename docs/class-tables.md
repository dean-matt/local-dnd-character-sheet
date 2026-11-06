# Class tables

How `classTableGroups` states what a class gets at each level, and what the ETL can and
cannot take from it. The tables themselves are in `packages/content/src/schema.ts` and
the loader is `packages/content/src/load/classes.ts`, which reads the table groups in
`class-table.ts`.

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

**Weapon Mastery** is a column only on Barbarian and Fighter. Paladin, Ranger and Rogue state
their two kinds in the feature's text, which `getWeaponMasteryCount` reads.

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

## Resource counters

A column that counts uses a character spends is a pool: Rages, Ki or Focus Points, Sorcery
Points, Channel Divinity, Second Wind, Wild Shape, Psi Points, Favored Enemy, and the
Psionic Energy dice a Psi Warrior's or Soulknife's subclass table prints. The derived
block lists each pool the class and subclass tables print at the character's level in its
class, and state records what is spent, so a level change moves every maximum with no state write. The
sheet reads state through `sheetState`, which caps what is spent at the maximum and drops a
pool the table no longer prints. `Unlimited` reads as no maximum.

Superiority Dice and the other resources no table prints are counters the user adds,
stored whole in state's `resources`:

```
name          "Superiority Dice"
current       3
maximum       4
resets_on     short | long | dawn | manual
```
