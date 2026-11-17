/**
 * The armor class a feature adds, read from the recorded feature mechanics.
 */
import type { Term } from "@dnd/rules";
import type { TermReference } from "./derivedField.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type Held, type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";

export type ArmorStance = {
  armor: "none" | "light" | "medium" | "heavy";
  /** Equipped melee weapons, one per hand at most. */
  meleeWeapons: number;
  dexterityScore: number;
};

export type ArmorClassEffects = {
  bonus: Term<TermReference>[];
  unarmoredBase: Term<TermReference> | undefined;
  mediumDexterityCap: number | undefined;
};

const holds = {
  armor: (stance: ArmorStance) => stance.armor !== "none",
  heavyArmor: (stance: ArmorStance) => stance.armor === "heavy",
  dualWield: (stance: ArmorStance) => stance.meleeWeapons >= 2,
};

function apply(effects: ArmorClassEffects, stance: ArmorStance, { ref, entry }: Held): void {
  for (const { value, when } of mechanicsOfKind(entry, "armorClass"))
    if (holds[when](stance)) effects.bonus.push({ label: ref.name, value, reference: ref });
  for (const { value } of mechanicsOfKind(entry, "unarmoredBase"))
    if (value > (effects.unarmoredBase?.value ?? 0))
      effects.unarmoredBase = { label: ref.name, value, reference: ref };
  for (const { cap, minimum } of mechanicsOfKind(entry, "mediumArmorDexterity"))
    if (stance.armor === "medium" && stance.dexterityScore >= minimum)
      effects.mediumDexterityCap = Math.max(effects.mediumDexterityCap ?? 0, cap);
}

export function armorClassEffects(
  definition: HoldsFeatures,
  stance: ArmorStance,
): ArmorClassEffects {
  const effects: ArmorClassEffects = {
    bonus: [],
    unarmoredBase: undefined,
    mediumDexterityCap: undefined,
  };
  for (const held of heldFeatures(definition)) apply(effects, stance, held);
  return effects;
}
