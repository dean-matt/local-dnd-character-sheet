# Dice notation

The grammar `@dnd/dice` reads. Anything else raises a `SyntaxError` naming the input.

```
pool [(+ | -) (pool | modifier)]...

pool = [count] d faces [kh n | kl n | dh n | dl n]
```

| Part | Required | Default | Rules |
|---|---|---|---|
| `count` | no | `1` | 1 to 1000. `d20` and `1d20` are the same roll |
| `d` | yes | | Separates the count from the faces. Case does not matter, so `1D20` reads |
| `faces` | yes | | 1 to 1000 |
| `kh n`, `kl n` | no | keep everything | Counts only the `n` highest or lowest dice toward the total. `n` cannot exceed `count`, and an `n` equal to it discards nothing, so it reads as no clause at all |
| `dl n`, `dh n` | no | keep everything | Discards the `n` lowest or highest dice, the same operation named from the other end. `dl` is the default, so `4d6d1` drops one. `n` must leave a die behind, and an `n` of `0` reads as no clause at all |
| `+ pool`, `- pool` | no | | Adds or subtracts a further pool. Each pool's dice appear in `dice` in the order they were rolled |
| `+ modifier`, `- modifier` | no | `0` | A constant added to or subtracted from the total. Several may appear; each is within 1000, and so is their sum |

```
d20        1d20        2d6+3       1d8-1
4d6kh3     2d20kl1     1D20+5      4d6dl1
1d8+1d6+3  2d6-1d4     1d2-2+2d3+5
```

A roll starts with a pool, so `3+1d6` does not read: write `1d6+3`. One roll puts at most
1000 dice on the table, counted across every pool.

Spaces are allowed around `d`, `k`, and the signs, but not inside a number: `2d6 + 3`
reads, `1d6 4` does not. Rejecting it matters, because otherwise it would quietly roll a
d64.

## Advantage and disadvantage

Not notation. Pass `mode` instead:

```ts
rollDice("1d20+5", { mode: "advantage" });
```

The rules only ever grant advantage on a single die, so a mode paired with notation that
rolls a pool, carries its own keep clause, or sums a second pool raises a `TypeError`.
Spelling it `2d20kh1` would work arithmetically but would leave a roll log unable to
explain the second die.

## Canonical form

The returned `notation` is rebuilt from the parsed parts rather than echoed back, so
spacing, case, and omitted defaults collapse. A drop clause comes back as the keep clause
it means, and scattered constants come back as one trailing modifier:

| Input | `notation` |
|---|---|
| `" 2d6 + 3 "` | `"2d6+3"` |
| `"d20"` | `"1d20"` |
| `"4D6KH3"` | `"4d6kh3"` |
| `"4d6dl1"`, `"4d6d1"` | `"4d6kh3"` |
| `"4d6dh1"` | `"4d6kl3"` |
| `"4d6kh4"`, `"4d6d0"` | `"4d6"` |
| `"1d2-2+2d3+5"` | `"1d2+2d3+3"` |

Store that, not the raw input, and the same roll typed two ways stays one row in a log.

## Wider dialects

No formal standard exists. Roll20 set the dialect most tools borrow, and others extend
it with exploding dice, rerolls, success counting, and more. None of that is read here.

- [Roll20 Dice Reference](https://wiki.roll20.net/Dice_Reference) — the dialect the others borrow from
- [Foundry VTT dice modifiers](https://foundryvtt.com/article/dice-modifiers/) — the dialect players type at the table
- [rpg-dice-roller modifiers](https://dice-roller.github.io/documentation/guide/notation/modifiers.html) — the fullest superset, with exact syntax for every modifier
- [Dice notation](https://en.wikipedia.org/wiki/Dice_notation) — the core count-`d`-faces grammar
