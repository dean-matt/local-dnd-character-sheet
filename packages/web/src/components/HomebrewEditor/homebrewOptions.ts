import type { SearchHit } from "@dnd/catalog";
import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import { titleCase } from "../../lib/proficiencyGrants.ts";

export type Option = { value: string; label: string };

/** The option a homebrew Select offers for a field the entry leaves out. */
export const NOT_STATED = { value: "", label: "Not stated" };

export const ABILITY_OPTIONS: Option[] = ABILITIES.map((value) => ({
  value,
  label: ABILITY_LABEL[value],
}));

/** A Select's options, with `current` added under its own spelling where none lists it. */
export function withCurrent(options: Option[], current: string) {
  return options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }];
}

/** `options` with each of `values` they lack, pasted or not yet loaded, listed under its own spelling. */
export const withValues = (options: Option[], values: readonly string[]): Option[] => [
  ...options,
  ...values
    .filter((value) => !options.some((option) => option.value === value))
    .map((value) => ({ value, label: titleCase(value.split("|")[0] ?? value) })),
];

/** Each hit once by its lowercased name, as upstream keys a race or a proficiency. */
export function byName(hits: readonly SearchHit[]): Option[] {
  const seen = new Set<string>();
  return hits.flatMap(({ name }) => {
    const value = name.toLowerCase();
    if (seen.has(value)) return [];
    seen.add(value);
    return [{ value, label: name }];
  });
}
