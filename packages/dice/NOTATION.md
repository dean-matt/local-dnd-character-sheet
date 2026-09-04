# Dice notation

No formal standard exists. Roll20 set the dialect everyone borrows, Foundry extends it,
and `@dice-roller/rpg-dice-roller` documents the fullest superset.

| Feature | Syntax | What it does | Where it appears | Supported |
|---|---|---|---|---|
| Pool | `2d6`, `d20` | Rolls a number of dice of one size and sums them | every system | yes |
| Flat modifier | `1d8+3`, `2d6-1` | Adds or subtracts a constant from the total | every system | yes |
| Keep highest, keep lowest | `4d6kh3`, `2d20kl1` | Rolls the whole pool, counts only the best or worst few | 5e ability scores, advantage | yes |
| Drop lowest, drop highest | `4d6dl1`, `4d6dh1` | The same operation spelled from the other end: names the dice to discard rather than the ones to count | 5e ability scores | no |
| Multi-term sum | `1d8+1d6+3` | Adds several pools and constants in one expression | 5e smite, sneak attack, hex | no |
| Percentile | `d%` | Shorthand for `d100` | 5e wild magic, loot tables | no |
| Reroll once, reroll always | `2d6ro<3`, `2d6r<3` | Rerolls dice matching a condition, the lowest face by default, and keeps the new result. `ro` rerolls at most once, `r` repeats while the condition holds | 5e Great Weapon Fighting | no |
| Clamp low, clamp high | `2d6min2`, `2d6max5` | Treats any die past the bound as the bound itself, without rerolling | 5e Elemental Adept | no |
| Exploding | `4d6!` | A die at its highest face rolls again, and the extra die adds to the total, repeating | Savage Worlds, Hackmaster | no |
| Compounding | `4d6!!` | Exploding, except the extra rolls fold into one die's value instead of appearing separately | Shadowrun | no |
| Penetrating | `4d6!p` | Exploding, except every extra roll takes a -1 penalty | Hackmaster | no |
| Success count | `5d10>=8` | Counts the dice that meet a condition instead of summing them | World of Darkness | no |
| Failure count | `5d10>=8f1` | Subtracts the dice that meet a failure condition from the success count | Shadowrun | no |
| Unique | `4d6u` | Rerolls duplicates until every die shows a different value | general purpose | no |
| Fudge dice | `4dF` | Rolls dice whose faces are -1, 0, and +1 | Fate | no |
| Grouped rolls | `{2d6+3, 1d8}kh1` | Applies a modifier to a bracketed set of rolls as one unit | general purpose | no |
| Sort | `4d6s`, `4d6sd` | Orders the dice for display, ascending or descending. The total does not change | display only | no |

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
