import { type Entries, rowEntries } from "./entry.ts";
import { deityEntries, languageEntries } from "./lookup-entries.ts";
import { legendaryGroupEntries, monsterEntries } from "./monster.ts";

/**
 * What a catalog row's detail renders, by the `type` a search hit carries: a table's own
 * rows, a monster's stat block, a legendary group's lair, a deity's or a language's fields
 * ahead of its prose, and every other row's `entries`. Empty where the detail would show
 * the row's name alone.
 */
export function catalogRowEntries(type: string, json: Record<string, unknown>): Entries {
  if (type === "table") return [{ ...json, type: "table" }];
  if (type === "monster") return monsterEntries(json);
  if (type === "legendaryGroup") return legendaryGroupEntries(json);
  if (type === "deity") return deityEntries(json);
  if (type === "language") return languageEntries(json);
  return rowEntries(json);
}
