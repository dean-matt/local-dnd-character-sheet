/** The save DC each held feature sets, read from its recorded `dc` mechanic. */
import { ABILITIES } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { refKey } from "./keys.ts";
import { type Ability, type ContentRef, catalogRef } from "./refs.ts";

type Increases = HoldsFeatures & Pick<CharacterDefinition, "abilityIncreases">;

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

/** The abilities a held feat raised, from its own picks and the increases placed at its improvement. */
function raisedBy(definition: Increases, ref: ContentRef): Ability[] {
  const feat = definition.feats.find((held) => {
    const catalog = catalogRef(held.ref);
    return catalog && refKey(catalog) === refKey(ref);
  });
  if (!feat) return [];
  const placed = definition.abilityIncreases.filter(
    (increase) =>
      increase.grantedBy === "feat" && feat.level !== undefined && increase.level === feat.level,
  );
  return [...placed, ...(feat.picks?.ability ?? [])]
    .filter((increase) => increase.amount > 0)
    .map((increase) => increase.ability);
}

/**
 * A feature once however many levels record it; one with no DC on this sheet is left out. A
 * feat whose DC names several abilities reads the one it raised, or the highest of them where
 * it raised none of them.
 */
export function featureDcs(definition: Increases, sheet: DcSheet): FeatureDc[] {
  const seen = new Set<string>();
  return heldFeatures(definition).flatMap(({ ref, entry }) => {
    const [mechanic] = mechanicsOfKind(entry, "dc");
    if (!mechanic || seen.has(refKey(ref))) return [];
    seen.add(refKey(ref));
    const { ability, spell, label = ref.name } = mechanic;
    const named = Array.isArray(ability) ? ability : ability && [ability];
    const raised = named?.filter((candidate) => raisedBy(definition, ref).includes(candidate));
    const abilities = raised?.length ? raised : named;
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
