import { type Edition, exhaustionEffects, type Term } from "@dnd/rules";
import type { TermReference } from "./derivedField.ts";

/**
 * The term 2024 exhaustion adds to a d20 Test's modifier, naming the level, or none where the
 * level is 0 or the edition's exhaustion is disadvantage instead. Spell save DCs and passive
 * scores are not d20 Tests and never take it.
 */
export function exhaustionPenaltyTerms(level: number, edition: Edition): Term<TermReference>[] {
  if (level === 0) return [];
  const effects = exhaustionEffects(level, edition);
  if (effects.edition !== "one") return [];
  return [
    { label: `Exhaustion ${level}: -${effects.d20TestPenalty}`, value: -effects.d20TestPenalty },
  ];
}
