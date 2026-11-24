/**
 * The spell picks the class and subclass features a character holds leave to the player,
 * by feature, and the grantor a pick made for one is stored under.
 */
import type { CharacterDefinition } from "./definition.ts";
import type { SpellPick } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures, spellPicks } from "./heldFeatures.ts";
import type { FeatureKey } from "./refs.ts";

type SpellPickedFor = NonNullable<CharacterDefinition["spells"][number]["pickedFor"]>;
export type ClassFeatureGrantor = Extract<SpellPickedFor, { kind: "classFeature" }>;

/** What a pick made for `feature` stores. */
export const classFeatureGrantor = ({
  name,
  source,
  className,
  classSource,
  level,
  subclass,
}: FeatureKey): ClassFeatureGrantor => ({
  kind: "classFeature",
  ref: { name, source },
  class: { name: className, source: classSource },
  level,
  ...(subclass && { subclass }),
});

/** Each held class or subclass feature that has the player pick spells, with its picks. */
export function featureSpellPicks(
  definition: HoldsFeatures,
): { feature: FeatureKey; picks: SpellPick[] }[] {
  return heldFeatures(definition).flatMap(({ entry }) => {
    const { ref } = entry;
    if (!("className" in ref)) return [];
    const picks = spellPicks(entry);
    return picks.length > 0 ? [{ feature: ref, picks }] : [];
  });
}
