import type { CharacterDefinition } from "./definition.ts";
import type { Derived } from "./derivedField.ts";
import { type HouseRule, type HouseRules, PRINTED_RULE } from "./houseRules.ts";

export function derivedValue<T>(field: Derived<T>): T {
  return field.manual ?? field.computed;
}

/**
 * How every reader asks. Reading `houseRules` directly restates the printed value at
 * each site — the duplication `derivedValue` also exists to prevent.
 *
 * One option at a time rather than a resolved set: a key written as `undefined` survives
 * the parse, so spreading the stored options over the printed ones would overwrite a
 * printed value with `undefined`.
 */
export function houseRule<K extends HouseRule>(
  definition: CharacterDefinition,
  rule: K,
): Required<HouseRules>[K] {
  // Both sides of the `??` index one mapped type through this annotation. Indexing
  // `definition.houseRules` directly compiles while every option is a boolean and stops
  // the day one is not, reporting the return rather than the read.
  const set: Partial<Required<HouseRules>> = definition.houseRules;
  return set[rule] ?? PRINTED_RULE[rule];
}
