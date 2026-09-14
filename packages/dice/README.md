# @dnd/dice

Parses dice notation and rolls it. `4d6kh3`, `4d6dl1`, `1d8+1d6+3`, `2d6-1d4`, with
advantage and disadvantage as an option rather than a notation trick.

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
//   dice: [{ faces: 6, value: 2, kept: true, sign: 1 },
//          { faces: 6, value: 5, kept: true, sign: 1 }] }

rollDice("4d6kh3");                          // roll four, keep the best three
rollDice("4d6dl1");                          // the same roll, naming the die to discard
rollDice("1d8+1d6+3");                       // sum several pools and constants
rollDice("1d20+5", { mode: "advantage" });   // roll two d20s, keep the higher
rollDice("2d6", { random: () => 0.5 });      // deterministic, for a test
```

## API

`rollDice(notation, options?)`

| Option | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `"normal" \| "advantage" \| "disadvantage"` | `"normal"` | Rolls a second die and keeps the higher or the lower. Only valid on notation that rolls a single die, keeps it, and sums no second pool |
| `random` | `() => number` | `Math.random` | Returns a float in `[0, 1)`. Pass one to make a test deterministic |

It returns:

| Field | Type | Meaning |
|---|---|---|
| `total` | `number` | The kept dice plus the modifier |
| `dice` | `RolledDie[]` | Every die rolled, across every pool, in roll order |
| `modifier` | `number` | Every constant in the notation, summed. `0` when it carries none |
| `notation` | `string` | The input in canonical form |

Each `RolledDie` is `{ faces, value, kept, sign }`. A die a keep clause discarded stays in
the array with `kept: false`, and a die belonging to a subtracted pool carries
`sign: -1`, so `total` can be read back off the dice.

`isRollable(notation)` answers whether `rollDice` would accept the notation, without
rolling it. It parses, so it cannot disagree with `rollDice`. A caller that renders text
uses it to decide whether to offer a roll at all:

```ts
import { isRollable } from "@dnd/dice";

isRollable("2d6-1d4");  // true
isRollable("4d6kh9");   // false, keeping more dice than are rolled
isRollable("5000d6");   // false, above the count bound
```

Canonical form strips spacing and fills in defaults, turning `" 2d6 + 3 "` into `"2d6+3"`
and `"d20"` into `"1d20"`. It also rewrites a drop clause as the keep clause it means and
collects scattered constants into one modifier, so `"4d6dl1"` becomes `"4d6kh3"` and
`"1d2-2+2d3+5"` becomes `"1d2+2d3+3"`. Two players who type the same roll differently
therefore write the same string to a log.

Die sizes and the summed modifier are capped at 1000, as is the number of dice a single
roll may put on the table across all its pools.

## Errors

Every message names the offending input.

| Thrown | When |
|---|---|
| `SyntaxError` | The notation is malformed |
| `RangeError` | A count, die size, modifier, or the dice a roll puts on the table at once falls outside 1-1000, or a keep or drop clause names more dice than its pool holds |
| `TypeError` | The notation is valid, but a mode does not fit it |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `TypeError: advantage applies to a single die` | A mode was paired with `2d6`, `4d6kh3`, or `1d20+1d6`. | Apply the mode to the d20 test itself, then add the pool separately |
| `SyntaxError` on notation that looks fine | A space inside a number, as in `1d6 4`. | Spaces are allowed around `d`, `k`, and the sign, nowhere else |
| `SyntaxError` on `3+1d6` | A roll starts with a pool, not a constant. | Write `1d6+3` |
| `SyntaxError` on `1d20k2` | A keep clause names its end. | Write `1d20kh2` or `1d20kl2` |
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
