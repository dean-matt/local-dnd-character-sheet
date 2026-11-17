/**
 * The half proficiency a held feature adds to an ability check that does not already use
 * proficiency, read from the recorded feature mechanics.
 */

import type { Term } from "@dnd/rules";
import { halfProficiency } from "@dnd/rules";
import type { TermReference } from "./derivedField.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { Ability } from "./refs.ts";

/** The largest half proficiency any held feature gives a check of `ability`; features do not stack. */
export function halfProficiencyTerm(
  definition: HoldsFeatures,
  ability: Ability,
  bonus: number,
): Term<TermReference> | undefined {
  let best: Term<TermReference> | undefined;
  for (const { ref, entry } of heldFeatures(definition))
    for (const { abilities, rounding } of mechanicsOfKind(entry, "halfProficiency")) {
      const value = halfProficiency(bonus, rounding);
      if (abilities.includes(ability) && value > (best?.value ?? 0))
        best = { label: ref.name, value, reference: ref };
    }
  return best;
}
