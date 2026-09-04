---
name: 5e-rules
description: Rules arithmetic for D&D 5e — proficiency bonus, ability modifiers, spell save DC, multiclass spell slots, rest resets, carrying capacity. Use for any calculation on a character sheet. These are the numbers that are easy to get subtly wrong from memory.
---

# 5e rules arithmetic

Implementations live in `packages/rules`: core arithmetic in `src/rules.ts`, multiclass
spellcasting in `src/spellcasting.ts`. Add to them rather than recalculating anywhere
else. The package depends on nothing and takes primitives — a function that wants a
whole `CharacterDefinition` is a projection and belongs in `packages/character`.

The two rulesets agree on everything here except caster progression, and that arrives
as an argument rather than an edition branch. Anything that cannot be passed in belongs
with the content that carries the `edition` column.

## Core

```
ability modifier    floor((score - 10) / 2)
proficiency bonus   2 + floor((level - 1) / 4)      level 1-20 only
spell save DC       8 + proficiency + ability modifier
spell attack bonus  proficiency + ability modifier
passive score       10 + modifier + proficiency (if proficient)
initiative          DEX modifier
```

Proficiency bonus by level, since the formula is easy to fence-post:

```
level   1-4  5-8  9-12  13-16  17-20
bonus    +2   +3    +4     +5     +6
```

## Multiclass spell slots

**Do not sum each class's own table.** Compute one combined caster level, then read the
shared multiclass table.

Do not classify by class name either — every casting class and subclass carries a
`casterProgression`, and `multiclassCasterLevel` takes those values verbatim so no
mapping can drift. Upstream calls half-rounded-up `artificer`, and the 2024 paladin and
ranger use it while the 2014 ones round down:

```
full         level                bard, cleric, druid, sorcerer, wizard
artificer    ceil(level / 2)      artificer, 2024 paladin, 2024 ranger
1/2          floor(level / 2)     2014 paladin, 2014 ranger
1/3          floor(level / 3)     Eldritch Knight, Arcane Trickster
pact         0                    warlock, counted apart
```

Round each class on its own and then add: two levels of round-down half caster
contribute nothing, not one.

Warlock **pact magic** is not part of this. Pact slots are tracked separately, all at
the same level, and recover on a short rest. A warlock/wizard has two independent slot
pools.

The combined table is in `content.db` under `spell_slots` for single-class casters; the
multiclass table is a constant in `spellcasting.ts` because upstream does not ship it.

## Rest resets

```
short rest   hit dice spent by choice, warlock pact slots, ki/focus points,
             superiority dice, channel divinity (some subclasses), second wind
long rest    hit points to max, half total hit dice recovered (minimum 1),
             spell slots, all class resources, one level of exhaustion removed
dawn         many magic items — a distinct trigger, not a long rest
```

An item's upstream `recharge` maps onto those four triggers through `resetsOn`.
`dusk`, `midnight` and `special` have no trigger of their own and degrade to `manual`,
which is nine items in total. Class resources ship no recharge value at all — the
trigger comes from feature prose, so the sheet stores what the user sets.

Exhaustion differs by edition in effect but not in how it is tracked: an integer 0-6,
where 6 is death.

## Carrying capacity

```
capacity        STR score x 15
encumbered      STR score x 5      speed -10
heavily enc.    STR score x 10     speed -20, disadvantage on most rolls
```

Size multiplies capacity: Tiny halves it, Large doubles, Huge x4, Gargantuan x8.

## Hit points on level up

```
average    floor(hit die / 2) + 1 + CON modifier
rolled     1d<hit die> + CON modifier
```

Level 1 is always the maximum die value plus the CON modifier. A CON modifier change
retroactively adjusts every level's contribution — recompute total hit points from
level rather than adjusting the current maximum by a delta.
