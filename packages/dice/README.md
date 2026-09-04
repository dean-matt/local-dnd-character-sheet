# @dnd/dice

Parses dice notation and rolls it. No dependencies.

[NOTATION.md](./NOTATION.md) lists the notation this package reads and the notation it
does not.

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
| `mode` | `"normal" \| "advantage" \| "disadvantage"` | `"normal"` | Rolls a second die and keeps the higher or the lower. Only valid on notation that rolls a single die and keeps it |
| `random` | `() => number` | `Math.random` | Returns a float in `[0, 1)`. Pass one to make a test deterministic |

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

## Errors

Every message names the offending input.

| Thrown | When |
|---|---|
| `SyntaxError` | The notation is malformed |
| `RangeError` | A count, die size, or modifier exceeds 1000 |
| `TypeError` | The notation is valid, but a mode does not fit it |
