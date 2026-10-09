import type { IncreaseAlternative } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { type Picks, raisesOf } from "../../lib/increasePicks.ts";

type Increase = CharacterDefinition["abilityIncreases"][number];

/** What grants the increases the flow places on the Ability Scores step's top half. */
export type Grantor = "race" | "background";

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
