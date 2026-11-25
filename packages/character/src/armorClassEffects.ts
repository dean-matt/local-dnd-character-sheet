/**
 * The armor class a feature adds, read from the recorded feature mechanics.
 */
import { ABILITY_LABEL, type Term } from "@dnd/rules";
import type { TermReference } from "./derivedField.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type Held, type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { Ability } from "./refs.ts";

export type ArmorStance = {
  armor: "none" | "light" | "medium" | "heavy";
  shield: boolean;
  /** Equipped melee weapons, one per hand at most. */
  meleeWeapons: number;
  dexterityScore: number;
  modifierOf: (ability: Ability) => number;
};

export type ArmorClassEffects = {
  bonus: Term<TermReference>[];
  /** The best unarmored base, read only while no armor is worn. */
  unarmoredBase: Term<TermReference> | undefined;
  /** Whether the best unarmored base leaves Dexterity out. */
  unarmoredBaseFixed: boolean;
  mediumDexterityCap: number | undefined;
};

const holds = {
  armor: (stance: ArmorStance) => stance.armor !== "none",
  heavyArmor: (stance: ArmorStance) => stance.armor === "heavy",
  dualWield: (stance: ArmorStance) => stance.meleeWeapons >= 2,
};

type UnarmoredBase = Extract<Mechanic, { kind: "unarmoredBase" }>;

/** A number, or an ability's modifier raised to `least`. */
function valueTerm(
  stance: ArmorStance,
  ref: Held["ref"],
  value: number | Ability,
  least = Number.NEGATIVE_INFINITY,
): Term<TermReference> {
  if (typeof value === "number") return { label: ref.name, value, reference: ref };
  const label = `${ref.name} (${ABILITY_LABEL[value]})`;
  return { label, value: Math.max(least, stance.modifierOf(value)), reference: ref };
}

function unarmoredTerm(
  stance: ArmorStance,
  ref: Held["ref"],
  { value, unlessShield }: UnarmoredBase,
): Term<TermReference> | undefined {
  return unlessShield && stance.shield ? undefined : valueTerm(stance, ref, value);
}

/** What an unarmored base adds to the 10, Dexterity included unless it is fixed. */
const total = (stance: ArmorStance, base: Term<TermReference>, fixed: boolean | undefined) =>
  base.value + (fixed ? 0 : stance.modifierOf("dex"));

const best = (effects: ArmorClassEffects, stance: ArmorStance) =>
  effects.unarmoredBase
    ? total(stance, effects.unarmoredBase, effects.unarmoredBaseFixed)
    : Number.NEGATIVE_INFINITY;

/**
 * Unarmored bases compete rather than sum, as the rule's "only one at a time" says, and one
 * adding nothing yields none, so a negative modifier never lowers the plain 10.
 */
function apply(effects: ArmorClassEffects, stance: ArmorStance, { ref, entry }: Held): void {
  for (const { value, when } of mechanicsOfKind(entry, "armorClass"))
    if (!when || holds[when](stance)) effects.bonus.push(valueTerm(stance, ref, value, 1));
  for (const mechanic of mechanicsOfKind(entry, "unarmoredBase")) {
    const term = unarmoredTerm(stance, ref, mechanic);
    if (term && term.value > 0 && total(stance, term, mechanic.fixed) > best(effects, stance)) {
      effects.unarmoredBase = term;
      effects.unarmoredBaseFixed = mechanic.fixed === true;
    }
  }
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
    unarmoredBaseFixed: false,
    mediumDexterityCap: undefined,
  };
  for (const held of heldFeatures(definition)) apply(effects, stance, held);
  return effects;
}
