export { armorClass } from "./armorclass.ts";
export type { Size } from "./carrying.ts";
export {
  carryingCapacity,
  encumbranceAt,
  encumbranceThresholds,
  POUNDS_PER_COIN,
  pushDragLiftCapacity,
  SIZES,
} from "./carrying.ts";
export {
  abilityModifier,
  PROFICIENCY_LEVELS,
  passiveScore,
  proficiencyBonus,
  proficiencyContribution,
} from "./core.ts";
export { damageAtZeroHitPoints, deathSave } from "./death.ts";
export type { Edition } from "./edition.ts";
export { EDITIONS } from "./edition.ts";
export { exhaustionEffects } from "./exhaustion.ts";
export type { HitDie, HitPointLevel } from "./hitpoints.ts";
export { averageHitPoints, HIT_DICE, hitDiceRecovered, maxHitPoints } from "./hitpoints.ts";
export { RESET_TRIGGERS, resetsOn } from "./rest.ts";
export type { CasterClassLevel, PreparationRule } from "./spellcasting.ts";
export {
  concentrationSaveDc,
  multiclassCasterLevel,
  multiclassSlots,
  preparedSpellCount,
  spellAttackBonus,
  spellSaveDc,
} from "./spellcasting.ts";
export type { Weapon } from "./weapon.ts";
export { weaponAttack } from "./weapon.ts";
