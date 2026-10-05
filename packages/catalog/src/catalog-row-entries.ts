import { type Entries, rowEntries } from "./entry.ts";
import { legendaryGroupEntries, monsterEntries } from "./monster.ts";

/**
 * What a catalog row's detail renders, by the `type` a search hit carries: a table's own
 * rows, a monster's stat block, a legendary group's lair, and every other row's
 * `entries`. Empty where the detail would show the row's name alone.
 */
export function catalogRowEntries(type: string, json: Record<string, unknown>): Entries {
  if (type === "table") return [{ ...json, type: "table" }];
  if (type === "monster") return monsterEntries(json);
  if (type === "legendaryGroup") return legendaryGroupEntries(json);
  return rowEntries(json);
}
