# @dnd/dice

Parses dice notation and rolls it. No dependencies.

```ts
import { rollDice } from "@dnd/dice";

rollDice("4d6kh3");
rollDice("1d20+5", { mode: "advantage" });
rollDice("2d6", { random: () => 0.5 });
```

## API

`rollDice(notation, options?)`

| Option | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `"normal" \| "advantage" \| "disadvantage"` | `"normal"` | Rolls a second die and keeps the higher or the lower |
| `random` | `() => number` | `Math.random` | Returns a float in `[0, 1)` |

It returns:

| Field | Type | Meaning |
|---|---|---|
| `total` | `number` | The kept dice plus the modifier |
| `dice` | `RolledDie[]` | Every die rolled, in roll order |
| `modifier` | `number` | The flat modifier, `0` when the notation carries none |
| `notation` | `string` | The input in canonical form |

Each `RolledDie` is `{ faces, value, kept }`. Discarded dice stay in the array with
`kept: false`, so the roll log can show the whole pool instead of a bare total.

Canonical form strips spacing and fills in defaults, turning `" 2d6 + 3 "` into
`"2d6+3"` and `"d20"` into `"1d20"`. Two players who type the same roll differently
therefore write the same string to the log.

Pass `random` to make a test deterministic. Because it is an argument rather than a
global, one test cannot disturb another.

## Advantage is a mode, not notation

A character sheet knows a roll is a d20 test before any notation exists, so advantage
and disadvantage belong in `options`, not in the string. Writing `2d20kh1` would hide
that: the log would show two dice and no reason for the second.

The rules only ever grant advantage on a single die, so `rollDice` rejects a mode paired
with notation that rolls a pool or carries its own keep clause.

## Errors

Every message names the offending input.

| Thrown | When |
|---|---|
| `SyntaxError` | The notation is malformed |
| `RangeError` | A count, die size, or modifier exceeds 1000 |
| `TypeError` | The notation is valid, but a mode does not fit it |

The bounds matter because notation also arrives from upstream `{@dice}` data, where
nobody has proofread it.

## The notation

No formal standard exists. Roll20 set the dialect everyone borrows, Foundry extends it,
and `@dice-roller/rpg-dice-roller` documents the fullest superset.

| Feature | Syntax | Where it appears | Supported |
|---|---|---|---|
| Pool | `2d6`, `d20` | every system | yes |
| Flat modifier | `1d8+3`, `2d6-1` | every system | yes |
| Keep highest, keep lowest | `4d6kh3`, `2d20kl1` | 5e ability scores, advantage | yes |
| Drop lowest, drop highest | `4d6dl1`, `4d6dh1` | 5e ability scores | no |
| Multi-term sum | `1d8+1d6+3` | 5e smite, sneak attack, hex | no |
| Percentile | `d%`, short for `d100` | 5e wild magic, loot tables | no |
| Reroll once, reroll always | `2d6ro<3`, `2d6r<3` | 5e Great Weapon Fighting | no |
| Clamp low, clamp high | `2d6min2`, `2d6max5` | 5e Elemental Adept | no |
| Exploding | `4d6!` | Savage Worlds, Hackmaster | no |
| Compounding | `4d6!!` | Shadowrun | no |
| Penetrating | `4d6!p` | Hackmaster | no |
| Success count | `5d10>=8` | World of Darkness | no |
| Failure count | `5d10>=8f1` | Shadowrun | no |
| Unique | `4d6u` | general purpose | no |
| Fudge dice | `4dF` | Fate | no |
| Grouped rolls | `{2d6+3, 1d8}kh1` | general purpose | no |
| Sort | `4d6s`, `4d6sd` | display only | no |

### What to add next

Two gaps are worth closing when a caller hits them. The rest of the table serves other
game systems.

1. **Multi-term sums.** A paladin who smites rolls `1d8+2d8`, and that throws today.
2. **`dl` and `dh`.** `4d6dl1` and `4d6kh3` are the same roll, and both spellings turn
   up in the wild. Watch the ambiguity: `d` already separates the count from the faces,
   so a parser has to read `4d6d1` by position.

## Why not `@dice-roller/rpg-dice-roller`

The community library is mature, MIT licensed, and covers every row above. Four things
ruled it out:

- Its random source is a module-level singleton, so tests share state.
- Advantage would go back to being the `2d20kh1` hack.
- Its result tree still needs flattening into the shape the roll log stores.
- It pulls `mathjs` into a package the web bundle ships.

Reconsider it the day this package needs the full grammar. `rollDice` is one function
behind one export, so the swap stays cheap.

## References

- [rpg-dice-roller modifiers](https://dice-roller.github.io/documentation/guide/notation/modifiers.html) — exact syntax for every modifier
- [rpg-dice-roller notation guide](https://dice-roller.github.io/documentation/guide/notation/) — dice types, groups, and maths
- [Foundry VTT dice modifiers](https://foundryvtt.com/article/dice-modifiers/) — the dialect players type at the table
- [Roll20 Dice Reference](https://wiki.roll20.net/Dice_Reference) — the dialect the others borrow from
- [Dice notation](https://en.wikipedia.org/wiki/Dice_notation) — the core count-`d`-faces grammar
