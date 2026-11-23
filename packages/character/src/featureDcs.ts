/** The save DC each held feature sets, read from its recorded `dc` mechanic. */
import { ABILITIES } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { refKey } from "./keys.ts";
import type { Ability } from "./refs.ts";

type FeatureDc = CharacterDerived["featureDcs"][number];
type Dc = FeatureDc["saveDc"];

/**
 * What a feature's DC reads off the sheet: the DC an ability sets, and the spell save DC of the
 * class named, absent where the character does not cast as that class.
 */
export type DcSheet = {
  modifier: (ability: Ability) => number;
  ability: (ability: Ability) => Dc;
  spell: (className: string) => Dc | undefined;
};

/** A feature once however many levels record it; one with no DC on this sheet is left out. */
export function featureDcs(definition: HoldsFeatures, sheet: DcSheet): FeatureDc[] {
  const seen = new Set<string>();
  return heldFeatures(definition).flatMap(({ ref, entry }) => {
    const [mechanic] = mechanicsOfKind(entry, "dc");
    if (!mechanic || seen.has(refKey(ref))) return [];
    seen.add(refKey(ref));
    const { ability, spell, label = ref.name } = mechanic;
    const abilities = Array.isArray(ability) ? ability : ability && [ability];
    const best = abilities
      ?.toSorted(
        (a, b) =>
          sheet.modifier(b) - sheet.modifier(a) || ABILITIES.indexOf(a) - ABILITIES.indexOf(b),
      )
      .at(0);
    const saveDc = best
      ? sheet.ability(best)
      : spell === undefined
        ? undefined
        : sheet.spell(spell);
    return saveDc ? [{ feature: ref, label, saveDc }] : [];
  });
}
