import { type Breakdown, breakdown, type Edition, exhaustionEffects } from "@dnd/rules";
import type { TermReference } from "./derivedField.ts";

/**
 * `maximum` with a term for classic exhaustion halving it, rounded down and leaving at least 1,
 * or as given where the edition or level halves nothing. It halves the printed maximum, before
 * temporary modifiers and a reduction, so those stay whole.
 */
export function exhaustedMaximum(
  maximum: Breakdown<TermReference>,
  level: number,
  edition: Edition,
): Breakdown<TermReference> {
  const effects = exhaustionEffects(level, edition);
  if (effects.edition !== "classic" || !effects.hitPointMaximumHalved) return maximum;
  const lost = maximum.total - Math.max(1, Math.floor(maximum.total / 2));
  return lost === 0
    ? maximum
    : breakdown([...maximum.terms, { label: `Exhaustion ${level}: maximum halved`, value: -lost }]);
}
