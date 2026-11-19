/** The limited uses each held feature counts, read from its recorded `uses` mechanic. */
import type { CharacterDerived } from "./characterDerived.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { Ability } from "./refs.ts";
import { houseRule } from "./resolve.ts";

type LimitedUses = CharacterDerived["limitedUses"][number];

/**
 * A count is at least the feature's printed minimum: 1 for each that prints "a minimum of
 * once", 0 for Divine Sense (PHB), which prints none. The `minimumOneUse` house rule raises
 * that 0 to 1. `value` gives an ability's modifier or the proficiency bonus.
 */
export function featureLimitedUses(
  definition: HoldsFeatures,
  value: (term: Ability | "proficiency") => number,
): LimitedUses[] {
  const atLeastOne = houseRule({ houseRules: definition.houseRules ?? {} }, "minimumOneUse");
  return heldFeatures(definition).flatMap((held) =>
    mechanicsOfKind(held.entry, "uses").map(
      ({ count, times = 1, plus = 0, minimum = 1, reset, scales = [] }) => {
        const reached = scales.filter((scale) => held.levels >= scale.level);
        const scaled = reached.findLast((scale) => scale.count !== undefined)?.count;
        const base = (typeof count === "number" ? (scaled ?? count) : value(count)) * times;
        const { ref } = held.entry;
        return {
          feature: held.ref,
          origin: held.origin,
          level: "className" in ref ? ref.level : null,
          key: held.usesKey,
          count: Math.max(atLeastOne ? 1 : minimum, base + plus),
          reset: reached.findLast((scale) => scale.reset !== undefined)?.reset ?? reset,
        };
      },
    ),
  );
}
