# Dice notation

The grammar `@dnd/dice` reads. Anything else raises a `SyntaxError` naming the input.

```
[count] d faces [kh n | kl n] [+ modifier | - modifier]
```

| Part | Required | Default | Rules |
|---|---|---|---|
| `count` | no | `1` | 1 to 1000. `d20` and `1d20` are the same roll |
| `d` | yes | | Separates the count from the faces. Case does not matter, so `1D20` reads |
| `faces` | yes | | 1 to 1000 |
| `kh n`, `kl n` | no | keep everything | Counts only the `n` highest or lowest dice toward the total. `n` cannot exceed `count` |
| `+ modifier`, `- modifier` | no | `0` | A constant added to or subtracted from the total, up to 1000 |

```
d20        1d20        2d6+3       1d8-1
4d6kh3     2d20kl1     1D20+5
```

Spaces are allowed around `d`, `k`, and the sign, but not inside a number: `2d6 + 3`
reads, `1d6 4` does not. Rejecting it matters, because otherwise it would quietly roll a
d64.

## Advantage and disadvantage

Not notation. Pass `mode` instead:

```ts
rollDice("1d20+5", { mode: "advantage" });
```

The rules only ever grant advantage on a single die, so a mode paired with notation that
rolls a pool or carries its own keep clause raises a `TypeError`. Spelling it `2d20kh1`
would work arithmetically but would leave a roll log unable to explain the second die.

## Canonical form

The returned `notation` is rebuilt from the parsed parts rather than echoed back, so
spacing, case, and omitted defaults collapse:

| Input | `notation` |
|---|---|
| `" 2d6 + 3 "` | `"2d6+3"` |
| `"d20"` | `"1d20"` |
| `"4D6KH3"` | `"4d6kh3"` |

Store that, not the raw input, and the same roll typed two ways stays one row in a log.

## Wider dialects

No formal standard exists. Roll20 set the dialect most tools borrow, and others extend
it with exploding dice, rerolls, success counting, and more. None of that is read here.

- [Roll20 Dice Reference](https://wiki.roll20.net/Dice_Reference) — the dialect the others borrow from
- [Foundry VTT dice modifiers](https://foundryvtt.com/article/dice-modifiers/) — the dialect players type at the table
- [rpg-dice-roller modifiers](https://dice-roller.github.io/documentation/guide/notation/modifiers.html) — the fullest superset, with exact syntax for every modifier
- [Dice notation](https://en.wikipedia.org/wiki/Dice_notation) — the core count-`d`-faces grammar
