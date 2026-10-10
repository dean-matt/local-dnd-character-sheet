import { type Breakdown, breakdown, type Term } from "@dnd/rules";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { improvementLabel } from "./improvements.ts";
import type { Ability } from "./refs.ts";

const GRANTOR_LABEL = { race: "Race", background: "Background" } as const;

type Scored = Pick<CharacterDefinition, "abilityScores" | "abilityIncreases"> &
  Partial<Pick<CharacterDefinition, "feats">>;

/**
 * What one worn item does to scores, as `abilityGrantSchema` reads it. A bonus stops at
 * `max` without lowering a score already past it; a static score replaces only a lower one.
 */
export type AbilityGrant = {
  name: string;
  static: Partial<Record<Ability, number>>;
  bonus: Partial<Record<Ability, number>>;
  max?: number;
};

/**
 * One ability's score: the base the definition stores, each increase as its own term, then
 * each item's `grants` named by the item. Bonuses add before a static score is compared,
 * so a static score counts against the total the bonuses reached.
 * Takes these fields alone so a creation draft, which holds no whole definition yet,
 * reads the same arithmetic the sheet does. `feats` names the feat an improvement took;
 * without it, the term names the improvement.
 */
export function abilityScoreBreakdown(
  definition: Scored,
  ability: Ability,
  grants: readonly AbilityGrant[] = [],
): Breakdown<TermReference> {
  const terms: Term<TermReference>[] = [
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
  ];
  let score = sum(terms);
  for (const grant of grants) {
    const bonus = grant.bonus[ability];
    if (bonus === undefined) continue;
    const capped = grant.max === undefined ? bonus : Math.min(bonus, grant.max - score);
    const value = bonus < 0 ? bonus : Math.max(capped, 0);
    if (value !== 0) terms.push({ label: grant.name, value });
    score += value;
  }
  for (const grant of grants) {
    const printed = grant.static[ability];
    if (printed === undefined || printed <= score) continue;
    terms.push({ label: grant.name, value: printed - score });
    score = printed;
  }
  return breakdown(terms);
}

const sum = (terms: readonly Term<TermReference>[]) =>
  terms.reduce((total, term) => total + term.value, 0);

export const abilityScore = (
  definition: Scored,
  ability: Ability,
  grants: readonly AbilityGrant[] = [],
): number => abilityScoreBreakdown(definition, ability, grants).total;
