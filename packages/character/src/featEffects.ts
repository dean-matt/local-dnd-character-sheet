/**
 * The initiative, hit point and speed bonuses a feature states only in its prose. 5etools
 * carries no field for them, so the sheet reads them from the recorded feature mechanics,
 * and a feature they do not name adds nothing.
 */
import type { Term } from "@dnd/rules";
import type { Speed } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { ContentRef } from "./refs.ts";

type FeatBonus = {
  initiative?: number | "proficiency";
  hitPointsPerLevel?: number;
  walk?: number;
};

/** What a held feature bonuses; `levels` scales a per-level bonus. */
function bonusFeats(
  definition: HoldsFeatures,
): { ref: ContentRef; bonus: FeatBonus; levels: number }[] {
  return heldFeatures(definition).map(({ ref, entry, levels }) => ({
    ref,
    levels,
    bonus: Object.fromEntries(
      mechanicsOfKind(entry, "bonus").map(({ target, value }) => [target, value]),
    ) as FeatBonus,
  }));
}

export function featInitiativeTerms(
  definition: HoldsFeatures,
  proficiencyBonus: number,
): Term<TermReference>[] {
  return bonusFeats(definition).flatMap(({ ref, bonus: { initiative } }) =>
    initiative === undefined
      ? []
      : [
          {
            label: ref.name,
            value: initiative === "proficiency" ? proficiencyBonus : initiative,
            reference: ref,
          },
        ],
  );
}

export function featHitPointTerms(definition: HoldsFeatures): Term<TermReference>[] {
  return bonusFeats(definition).flatMap(({ ref, levels, bonus: { hitPointsPerLevel } }) =>
    hitPointsPerLevel === undefined
      ? []
      : [{ label: ref.name, value: hitPointsPerLevel * levels, reference: ref }],
  );
}

/** Applied to the race's speed, so an item that sets or scales a speed reads the raised walk. */
export function speedWithFeats(
  base: Speed,
  definition: HoldsFeatures,
): { speed: Speed; terms: Term<TermReference>[] } {
  let walk = base.walk;
  const terms: Term<TermReference>[] = [];
  if (walk === undefined) return { speed: base, terms };
  for (const { ref, bonus } of bonusFeats(definition)) {
    if (bonus.walk === undefined) continue;
    terms.push({
      label: `${ref.name}: walk ${walk} to ${walk + bonus.walk}`,
      value: bonus.walk,
      reference: ref,
    });
    walk += bonus.walk;
  }
  return { speed: { ...base, walk }, terms };
}
