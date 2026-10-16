import { z } from "zod";
import { abilityGrantSchema } from "./ability.ts";
import { defenseTraitSchema } from "./defense.ts";
import {
  ammunitionTraitSchema,
  armorBurdenSchema,
  armorTraitSchema,
  containerTraitSchema,
  homebrewItemSchema,
  weaponTraitSchema,
} from "./item.ts";
import { itemBonusSchema } from "./item-bonus.ts";

/** `weight`, `value` and `wondrous` are read off the entry directly, with no trait schema to borrow. */
const shape = {
  ...homebrewItemSchema.pick({ type: true, rarity: true, reqAttune: true, advantage: true }).shape,
  wondrous: z.literal(true).optional(),
  weight: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
  ...armorTraitSchema.in.shape,
  ...armorBurdenSchema.in.shape,
  ...weaponTraitSchema.in.shape,
  ...ammunitionTraitSchema.in.shape,
  ...containerTraitSchema.in.shape,
  ...defenseTraitSchema.in.shape,
  ...abilityGrantSchema.in.shape,
  ...itemBonusSchema.in.shape,
};

type Shape = typeof shape;

const DESCRIPTIONS: { [K in keyof Shape]: string } = {
  type: 'The item type code, such as "M" for a melee weapon, "MA" for medium armor or "P" for a potion. A potion grants none of the bonuses or defenses below.',
  rarity: 'Such as "rare". Prices an item that states no value.',
  reqAttune:
    'true, or a condition such as "by a wizard". Holds the item\'s bonuses until it is attuned.',
  advantage:
    'Advantage or disadvantage the item grants, such as [{"mode": "advantage", "roll": "save", "condition": "against spells"}].',
  wondrous: "true for a wondrous item.",
  weight: "Pounds, such as 3.",
  value: "Price in copper pieces: 50 is 5 sp, 100 is 1 gp.",
  ac: "Armor class, such as 14, on armor or a shield.",
  bonusAc: 'A bonus to AC, such as "+1". On armor or a shield it adds to ac.',
  stealth: "true where the armor gives disadvantage on Stealth checks.",
  strength: 'The Strength score, such as "13", below which the armor costs 10 feet of speed.',
  baseItem:
    'The weapon this one is built on, such as "longsword|xphb", for proficiency and mastery.',
  staff: "true for a staff, which attacks as a quarterstaff.",
  weaponCategory: '"simple" or "martial".',
  dmg1: 'The damage die, such as "1d8".',
  dmg2: 'The versatile damage die, such as "1d10".',
  dmgType: 'The damage type code, such as "S" for slashing or "F" for fire.',
  property: 'Weapon property codes, such as ["V", "F"].',
  mastery: 'Weapon mastery properties, such as ["Topple|XPHB"].',
  range: 'Normal and long range in feet, such as "80/320".',
  ammoType: 'The ammunition it fires, such as "arrow|xphb".',
  reload: "Shots a firearm holds before it reloads, such as 6.",
  bonusWeapon: 'A bonus to attack and damage rolls, such as "+1".',
  bonusWeaponAttack: 'A bonus to attack rolls alone, such as "+1".',
  bonusWeaponDamage: 'A bonus to damage rolls alone, such as "+1".',
  packContents: 'What an ammunition pack holds, such as [{"item": "arrow|xphb", "quantity": 20}].',
  containerCapacity:
    'What a container holds, such as {"weight": [30]}, or {"weightless": true} for a Bag of Holding.',
  resist: 'Damage types resisted, such as ["cold"].',
  immune: 'Damage types the wearer is immune to, such as ["fire"].',
  conditionImmune: 'Conditions the wearer is immune to, such as ["frightened"].',
  vulnerable: 'Damage types the wearer is vulnerable to, such as ["thunder"].',
  ability:
    'Ability scores: {"wis": 1} adds 1 to Wisdom, {"static": {"str": 19}} sets Strength to 19 where it is lower, and "max" caps a bonus.',
  bonusSavingThrow: 'A bonus to every saving throw, such as "+1".',
  bonusSavingThrowConcentration:
    'A bonus to Constitution saves to keep concentration, such as "+2".',
  bonusSpellAttack: 'A bonus to spell attack rolls, such as "+1".',
  bonusSpellSaveDc: 'A bonus to spell save DC, such as "+1".',
  bonusSpellDamage: 'A bonus to spell damage rolls, such as "+1".',
  bonusAbilityCheck: 'A bonus to every ability check, such as "+1".',
  bonusProficiencyBonus: 'A bonus to proficiency bonus, such as "+1".',
  critThreshold: "The lowest d20 roll that scores a critical hit, such as 19.",
  modifySpeed:
    'Speed: {"bonus": {"walk": 10}} adds feet, {"static": {"fly": 30}} sets a speed, {"equal": {"swim": "walk"}} matches one to another, and {"multiply": {"walk": 2}} scales one. "*" in bonus means every speed.',
  grantsProficiency: "true where the item grants a proficiency its text names.",
  grantsLanguage: "true where the item grants a language its text names.",
};

const described = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [
    key,
    schema.describe(DESCRIPTIONS[key as keyof Shape]),
  ]),
) as Shape;

/**
 * Every field the sheet reads off an item entry, in the shape it reads it, each described
 * for a table writing a homebrew item. Composed from the schemas that read each field, so
 * a field one of them gains reaches this list and fails typecheck until it is described.
 * Every other field, rules text and its `{@tags}` among them, only displays.
 */
export const appliedItemFieldsSchema = z.object(described);
