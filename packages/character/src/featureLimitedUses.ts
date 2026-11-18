/** The limited uses each held feature counts, read from its recorded `uses` mechanic. */
import type { CharacterDerived } from "./characterDerived.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { Ability } from "./refs.ts";

type LimitedUses = CharacterDerived["limitedUses"][number];

/**
 * A count is at least 1, as each feature counted by a modifier says. Divine Sense alone prints
 * no minimum, so below a Charisma modifier of 0 it shows a use more than its rules give.
 */
export function featureLimitedUses(
  definition: HoldsFeatures,
  modifier: (ability: Ability) => number,
): LimitedUses[] {
  return heldFeatures(definition).flatMap((held) =>
    mechanicsOfKind(held.entry, "uses").map(({ count, plus = 0, reset, scales = [] }) => {
      const reached = scales.filter((scale) => held.levels >= scale.level);
      const scaled = reached.findLast((scale) => scale.count !== undefined)?.count;
      const base = typeof count === "number" ? (scaled ?? count) : modifier(count);
      const { ref } = held.entry;
      return {
        feature: held.ref,
        origin: held.origin,
        level: "className" in ref ? ref.level : null,
        key: held.usesKey,
        count: Math.max(1, base + plus),
        reset: reached.findLast((scale) => scale.reset !== undefined)?.reset ?? reset,
      };
    }),
  );
}
