# @dnd/dice

Dice notation parsing and rolling. One entry point:

```ts
import { rollDice } from "@dnd/dice";

rollDice("4d6kh3");
// { total, dice: [{ faces, value, kept }], modifier, notation }

rollDice("1d20+5", { mode: "advantage" });
rollDice("2d6", { random: () => 0.5 });
```

Every die rolled comes back, discarded ones flagged `kept: false`, so the roll log can
show the whole pool rather than a total the reader has to trust. `notation` is returned
in canonical form (`" 2d6 + 3 "` becomes `"2d6+3"`), so the same roll typed with
different spacing does not split into two rows.

`random` is injected per call rather than set globally, so tests are deterministic
without sharing state.

## Advantage is a mode, not notation

The rules grant advantage on a d20 test the sheet already knows how to make, before any
string exists. Spelling it `2d20kh1` would leave the log unable to say why the second
die is there, so it is a `mode` instead, and it is rejected on notation rolling a pool
or carrying its own keep clause.

## Errors

| Thrown | When |
|---|---|
| `SyntaxError` | The notation is malformed |
| `RangeError` | A count, die size or modifier is out of bounds |
| `TypeError` | The notation is fine but a mode does not fit it |

Counts, faces and modifiers are capped at 1000. Notation also arrives from upstream
`{@dice}` data, not only from something a user typed.

## The notation

There is no formal standard. The Roll20 dialect is the closest thing to one, Foundry
extends it, and `@dice-roller/rpg-dice-roller` documents the fullest superset.

| Feature | Syntax | Used by | Supported |
|---|---|---|---|
| Basic pool | `2d6`, `d20` | everything | yes |
| Flat modifier | `1d8+3`, `2d6-1` | everything | yes |
| Keep highest, lowest | `4d6kh3`, `2d20kl1` | 5e ability scores, advantage | yes |
| Drop lowest, highest | `4d6dl1`, `4d6dh1` | the same roll, spelled the other way | no |
| Multi-term sum | `1d8+1d6+3` | 5e smite, sneak attack, hex | no |
| Percentile | `d%`, short for `d100` | 5e wild magic, loot tables | no |
| Reroll once, always | `2d6ro<3`, `2d6r<3` | 5e Great Weapon Fighting | no |
| Clamp low, high | `2d6min2`, `2d6max5` | 5e Elemental Adept | no |
| Exploding | `4d6!` | Savage Worlds, Hackmaster | no |
| Compounding | `4d6!!` | Shadowrun | no |
| Penetrating | `4d6!p` | Hackmaster | no |
| Target and success count | `5d10>=8` | World of Darkness | no |
| Failure count | `5d10>=8f1` | Shadowrun | no |
| Unique | `4d6u` | generic | no |
| Fudge dice | `4dF` | Fate | no |
| Grouped rolls | `{2d6+3, 1d8}kh1` | generic | no |
| Sort | `4d6s`, `4d6sd` | display only | no |

Worth adding first, if a caller needs them:

1. **Multi-term sums.** A paladin who smites rolls `1d8+2d8`, and today that throws.
2. **`dl` and `dh`.** `4d6dl1` and `4d6kh3` are the same roll, and both spellings appear
   in the wild. The trap: `d` already separates count from faces, so `4d6d1` has to be
   parsed positionally.

Everything below those belongs to other game systems.

## References

- [rpg-dice-roller modifiers](https://dice-roller.github.io/documentation/guide/notation/modifiers.html) — exact syntax per modifier, the fullest reference
- [rpg-dice-roller notation guide](https://dice-roller.github.io/documentation/guide/notation/) — dice types, groups, maths
- [Foundry VTT dice modifiers](https://foundryvtt.com/article/dice-modifiers/) — the dialect players actually type
- [Dice notation](https://en.wikipedia.org/wiki/Dice_notation) — the core count-`d`-faces grammar
- Roll20's Dice Reference wiki is the other canonical source; it blocks automated fetching

## Why this is not `@dice-roller/rpg-dice-roller`

That library is mature, MIT and covers the whole table above. It was weighed and set
aside: its random source is a module-level singleton rather than a per-call injection,
advantage would have to be spelled as the `2d20kh1` hack, its result tree needs
flattening to the shape the roll log stores anyway, and it pulls `mathjs` into a package
the web bundle ships. Reconsider it the day this package needs the full grammar —
`rollDice` is one function behind one export, so it can be swapped underneath.
