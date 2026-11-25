import type { RollEffectEntry, RollOption } from "@dnd/character";

/** What a conditional entry does to the roll, as its checkbox reads. */
export const doing = (entry: RollEffectEntry | RollOption) =>
  "mode" in entry ? (entry.mode === "advantage" ? "Adv" : "Dis") : `+${entry.dice ?? entry.value}`;

export const optionKey = (entry: RollEffectEntry | RollOption) =>
  `${entry.source}|${doing(entry)}|${entry.condition}`;

/** `terms` with the ticked options' flat terms after them; the same array where there are none. */
export const withTerms = <T>(terms: T[] | undefined, flat: readonly T[]) =>
  flat.length === 0 ? terms : terms && [...terms, ...flat];
