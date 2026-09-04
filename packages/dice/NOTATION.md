# Dice notation

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

Multi-term sums and drop notation are tracked in
[issue #16](https://github.com/dean-matt/local-dnd-character-sheet/issues/16). Drop
carries a trap: `d` already separates the count from the faces, so `4d6d1` has to be
read by position.

## References

- [rpg-dice-roller modifiers](https://dice-roller.github.io/documentation/guide/notation/modifiers.html) — exact syntax for every modifier
- [rpg-dice-roller notation guide](https://dice-roller.github.io/documentation/guide/notation/) — dice types, groups, and maths
- [Foundry VTT dice modifiers](https://foundryvtt.com/article/dice-modifiers/) — the dialect players type at the table
- [Roll20 Dice Reference](https://wiki.roll20.net/Dice_Reference) — the dialect the others borrow from
- [Dice notation](https://en.wikipedia.org/wiki/Dice_notation) — the core count-`d`-faces grammar
