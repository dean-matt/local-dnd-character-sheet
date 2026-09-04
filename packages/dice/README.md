# @dnd/dice

Parses dice notation and rolls it. `4d6kh3`, `2d20kl1`, `1d8-1`, with advantage and
disadvantage as an option rather than a notation trick.

Every die rolled comes back, discarded ones included, so a roll log can show the whole
pool instead of a bare total. No dependencies, no global state, and the random source is
an argument.

## Install

```bash
pnpm add @dnd/dice
```

Not published yet — it currently ships inside the
[local-dnd-character-sheet](https://github.com/dean-matt/local-dnd-character-sheet)
repository, where workspace packages resolve it by name.

Requires Node 24 or newer, or any browser. The package is ESM only and ships TypeScript
types.

## Getting started

```ts
import { rollDice } from "@dnd/dice";

rollDice("2d6+3");
// { total: 10, modifier: 3, notation: "2d6+3",
//   dice: [{ faces: 6, value: 2, kept: true }, { faces: 6, value: 5, kept: true }] }

rollDice("4d6kh3");                          // roll four, keep the best three
rollDice("1d20+5", { mode: "advantage" });   // roll two d20s, keep the higher
rollDice("2d6", { random: () => 0.5 });      // deterministic, for a test
```

## API

`rollDice(notation, options?)`

| Option | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `"normal" \| "advantage" \| "disadvantage"` | `"normal"` | Rolls a second die and keeps the higher or the lower. Only valid on notation that rolls a single die and keeps it |
| `random` | `() => number` | `Math.random` | Returns a float in `[0, 1)`. Pass one to make a test deterministic |

It returns:

| Field | Type | Meaning |
|---|---|---|
| `total` | `number` | The kept dice plus the modifier |
| `dice` | `RolledDie[]` | Every die rolled, in roll order |
| `modifier` | `number` | The flat modifier, `0` when the notation carries none |
| `notation` | `string` | The input in canonical form |

Each `RolledDie` is `{ faces, value, kept }`. A die a keep clause discarded stays in the
array with `kept: false`.

Canonical form strips spacing and fills in defaults, turning `" 2d6 + 3 "` into `"2d6+3"`
and `"d20"` into `"1d20"`. Two players who type the same roll differently therefore
write the same string to a log.

Counts, die sizes, and modifiers are capped at 1000 each.

## Errors

Every message names the offending input.

| Thrown | When |
|---|---|
| `SyntaxError` | The notation is malformed |
| `RangeError` | A count, die size, or modifier exceeds 1000 |
| `TypeError` | The notation is valid, but a mode does not fit it |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `TypeError: advantage applies to a single die` | A mode was paired with `2d6` or `4d6kh3`. | Apply the mode to the d20 test itself, then add the pool separately |
| `SyntaxError` on notation that looks fine | A space inside a number, as in `1d6 4`. | Spaces are allowed around `d`, `k`, and the sign, nowhere else |
| `SyntaxError` on `1d8+1d6` | Multi-term sums are not supported yet. | Roll each term and add the totals; see [issue #16](https://github.com/dean-matt/local-dnd-character-sheet/issues/16) |
| The same roll logs as two different rows | The raw input was stored rather than `notation`. | Store the returned `notation`, which is canonical |
| A test fails intermittently | The roll used the default `Math.random`. | Pass `random` |

## Further reading

| File | What it is |
|---|---|
| [`NOTATION.md`](NOTATION.md) | The grammar this package reads, in full |

## Contributing

Issues and pull requests go to the
[local-dnd-character-sheet](https://github.com/dean-matt/local-dnd-character-sheet)
repository. Commits follow Conventional Commits under the `dice` scope.

## License

MIT
