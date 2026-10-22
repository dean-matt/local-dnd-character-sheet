import { abilityIncreasesSchema, customOrigin, type IncreaseAlternative } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { type Picks, raisesOf } from "./increasePicks.ts";

type Increase = CharacterDefinition["abilityIncreases"][number];

/** What grants the increases a character's origin places: its race and its background. */
export type Grantor = "race" | "background";

export type IncreaseSource = {
  grantedBy: Grantor;
  /** The row's name, for saying where an increase comes from. */
  name: string;
  alternatives: IncreaseAlternative[];
};

/**
 * What a race or background row offers to raise, none where no row is held. `freed` is the
 * custom-origin house rule, which frees the increases to any ability.
 */
export function increaseSource(
  grantedBy: Grantor,
  name: string,
  json: unknown,
  freed = false,
): IncreaseSource {
  const alternatives = json === undefined ? [] : abilityIncreasesSchema.parse(json);
  return { grantedBy, name, alternatives: freed ? customOrigin(alternatives) : alternatives };
}

/** The increases `picks` stores for `grantedBy`. */
export const increasesOf = (
  alternatives: readonly IncreaseAlternative[],
  picks: Picks,
  grantedBy: Grantor,
): Increase[] => raisesOf(alternatives, picks).map((raise) => ({ ...raise, grantedBy }));

/** `increases` with `grantedBy`'s replaced by `mine`. */
export const withIncreases = (
  increases: readonly Increase[] | undefined,
  grantedBy: Grantor,
  mine: readonly Increase[],
): Increase[] => [
  ...(increases ?? []).filter((increase) => increase.grantedBy !== grantedBy),
  ...mine,
];

/**
 * What a grantor's increases become where the stored ones no longer read against its row:
 * the row's fixed increases where it offers one way to take them, else none.
 */
export const resetIncreases = ({ grantedBy, alternatives }: IncreaseSource): Increase[] =>
  alternatives.length === 1
    ? increasesOf(alternatives, { alternative: 0, slots: [] }, grantedBy)
    : [];
