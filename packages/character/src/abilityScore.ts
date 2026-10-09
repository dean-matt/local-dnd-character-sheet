import { type Breakdown, breakdown } from "@dnd/rules";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { improvementLabel } from "./improvements.ts";
import type { Ability } from "./refs.ts";

const GRANTOR_LABEL = { race: "Race", background: "Background" } as const;

type Scored = Pick<CharacterDefinition, "abilityScores" | "abilityIncreases"> &
  Partial<Pick<CharacterDefinition, "feats">>;

/**
 * One ability's score: the base the definition stores, then each increase as its own term.
 * Takes these fields alone so a creation draft, which holds no whole definition yet,
 * reads the same arithmetic the sheet does. `feats` names the feat an improvement took;
 * without it, the term names the improvement.
 */
export function abilityScoreBreakdown(
  definition: Scored,
  ability: Ability,
): Breakdown<TermReference> {
  return breakdown([
    { label: "Base", value: definition.abilityScores[ability] },
    ...definition.abilityIncreases
      .filter((increase) => increase.ability === ability)
      .map((increase) => ({
        label:
          increase.grantedBy === "race" || increase.grantedBy === "background"
            ? GRANTOR_LABEL[increase.grantedBy]
            : improvementLabel(definition.feats, increase.level ?? 0),
        value: increase.amount,
      })),
  ]);
}

export const abilityScore = (definition: Scored, ability: Ability): number =>
  abilityScoreBreakdown(definition, ability).total;
