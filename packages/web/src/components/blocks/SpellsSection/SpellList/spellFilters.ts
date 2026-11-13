import type { SheetSpell } from "@dnd/catalog";
import type { Facet } from "../../../Filter/facets.ts";

const TIMES = ["Action", "Bonus action", "Reaction", "Longer"] as const;

export const TIME_OPTIONS = TIMES.map((value) => ({ value, label: value }));

const TIME_OF_UNIT: Record<string, (typeof TIMES)[number]> = {
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
};

export const TIME_FACET: Facet<SheetSpell> = {
  key: "time",
  label: "Casting time",
  valuesOf: (spell) =>
    spell.resolved ? (spell.time ?? []).map(({ unit }) => TIME_OF_UNIT[unit] ?? "Longer") : [],
};

/** Each narrows on its own, so ticking two keeps only the spells that are both. */
const ONLY = {
  prepared: {
    label: "Prepared",
    // What the character does not prepare (a cantrip, a granted spell, a known spell) is always ready.
    holds: (spell: SheetSpell, preparable: boolean) =>
      spell.resolved && (spell.prepared || !preparable || !!spell.pickedFor),
  },
  concentration: {
    label: "Concentration",
    holds: (spell: SheetSpell) => spell.resolved && spell.concentration,
  },
  ritual: { label: "Ritual", holds: (spell: SheetSpell) => spell.resolved && spell.ritual },
};

export const ONLY_OPTIONS = Object.entries(ONLY).map(([value, { label }]) => ({ value, label }));

export const holdsEvery = (spell: SheetSpell, ticked: readonly string[], preparable: boolean) =>
  ticked.every((key) => ONLY[key as keyof typeof ONLY]?.holds(spell, preparable));
