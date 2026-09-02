---
name: 5e-rules
description: Rules arithmetic for D&D 5e — proficiency bonus, ability modifiers, spell save DC, multiclass spell slots, rest resets, carrying capacity. Use for any calculation on a character sheet. These are the numbers that are easy to get subtly wrong from memory.
---

# 5e rules arithmetic

Implementations live in `packages/shared/src/rules.ts` and are used by both the API and
the web client. Add to that file rather than recalculating anywhere else.

Both the 2014 and 2024 rulesets agree on everything here. Edition-specific rules belong
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

```
full caster    bard, cleric, druid, sorcerer, wizard      levels count fully
half caster    paladin, ranger, artificer                 artificer rounds UP, others
                                                          count as floor(level / 2)
third caster   Eldritch Knight, Arcane Trickster          floor(level / 3)
```

Warlock **pact magic** is not part of this. Pact slots are tracked separately, all at
the same level, and recover on a short rest. A warlock/wizard has two independent slot
pools.

The combined table is in `content.db` under `spell_slots` for single-class casters; the
multiclass table is a constant in `rules.ts` because upstream does not ship it.

## Rest resets

```
short rest   hit dice spent by choice, warlock pact slots, ki/focus points,
             superiority dice, channel divinity (some subclasses), second wind
long rest    hit points to max, half total hit dice recovered (minimum 1),
             spell slots, all class resources, one level of exhaustion removed
dawn         many magic items — a distinct trigger, not a long rest
```

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
