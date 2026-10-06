import { type Breakdown, breakdown } from "@dnd/rules";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import type { Ability } from "./refs.ts";

const GRANTOR_LABEL = { race: "Race", background: "Background" } as const;

/**
 * One ability's score: the base the definition stores, then each increase as its own term.
 * Takes the two fields alone so a creation draft, which holds no whole definition yet,
 * reads the same arithmetic the sheet does.
 */
export function abilityScoreBreakdown(
  definition: Pick<CharacterDefinition, "abilityScores" | "abilityIncreases">,
  ability: Ability,
): Breakdown<TermReference> {
  return breakdown([
    { label: "Base", value: definition.abilityScores[ability] },
    ...definition.abilityIncreases
      .filter((increase) => increase.ability === ability)
      .map((increase) => ({ label: GRANTOR_LABEL[increase.grantedBy], value: increase.amount })),
  ]);
}

export const abilityScore = (
  definition: Pick<CharacterDefinition, "abilityScores" | "abilityIncreases">,
  ability: Ability,
): number => abilityScoreBreakdown(definition, ability).total;
