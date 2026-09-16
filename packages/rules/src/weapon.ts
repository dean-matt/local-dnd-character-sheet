/**
 * A weapon's attack bonus and damage, from a base item's own fields and the modifiers a
 * caller has already looked up.
 *
 * Which weapons a character is proficient with, and whether they are wielding one, each
 * need the whole character, so they stay in the projection over the definition and arrive
 * here as a proficiency bonus and a grip.
 */

import { assertInteger } from "./integer.ts";

type WeaponKind = "melee" | "ranged";

/** The ability a weapon attacks with. Returned so a sheet can label the number. */
type WeaponAbility = "strength" | "dexterity";

/** Which damage die a versatile weapon rolls; every other weapon rolls its one die. */
type Grip = "one-handed" | "two-handed";

export type Weapon = {
  /**
   * From the base item's `type`, `M` or `R` — never its `weaponCategory`, which says
   * simple or martial and decides nothing here.
   */
  kind: WeaponKind;
  /**
   * `{@itemProperty}` abbreviations as the base item spells them, source qualifier and
   * all: `F`, `V|XPHB`. Only finesse changes a number; every other abbreviation is
   * ignored.
   */
  properties?: readonly string[];
  /** The base item's `dmg1`, passed through for `@dnd/dice` to parse. */
  damage: string;
  /** A versatile weapon's `dmg2`, the die it rolls in two hands. */
  versatileDamage?: string;
};

type WeaponAttackParts = {
  weapon: Weapon;
  strengthModifier: number;
  dexterityModifier: number;
  /**
   * What proficiency is worth against this weapon, and 0 where the character has none. A
   * number rather than a flag, so half proficiency or an expertise-like source needs no
   * second function, as `passiveScore` already does. Required rather than defaulted,
   * because a default understates every attack a proficient character makes.
   */
  proficiency: number;
  /** A magic weapon's flat bonus, which the attack roll and the damage both take. */
  bonus?: number;
  /**
   * Required rather than defaulted, because a versatile weapon under a default rolls its
   * smaller die and says nothing.
   */
  grip: Grip;
};

type WeaponAttack = {
  ability: WeaponAbility;
  attackBonus: number;
  /** Dice notation, beside the flat modifier rather than folded into it. */
  damage: string;
  damageModifier: number;
};

const FINESSE = "F";

/** An abbreviation carries an optional source, and upstream spells one occurrence lowercase. */
function abbreviation(property: string): string {
  return property.replace(/\|.*$/, "").toUpperCase();
}

/**
 * A melee weapon uses Strength and a ranged weapon Dexterity, and finesse offers the
 * choice, which a sheet resolves to the better of the two.
 *
 * Thrown needs no branch: a thrown melee weapon is still melee, and the two thrown weapons
 * upstream types as ranged — the dart and the net — reach Dexterity by being ranged. A tie
 * leaves the choice moot, so the weapon's own ability keeps the label steady.
 */
function weaponAbility(
  weapon: Weapon,
  strengthModifier: number,
  dexterityModifier: number,
): WeaponAbility {
  const own: WeaponAbility = weapon.kind === "ranged" ? "dexterity" : "strength";
  const finesse = weapon.properties?.some((property) => abbreviation(property) === FINESSE);
  if (!finesse || strengthModifier === dexterityModifier) {
    return own;
  }
  return strengthModifier > dexterityModifier ? "strength" : "dexterity";
}

export function weaponAttack({
  weapon,
  strengthModifier,
  dexterityModifier,
  proficiency,
  bonus = 0,
  grip,
}: WeaponAttackParts): WeaponAttack {
  assertInteger("A Strength modifier", strengthModifier);
  assertInteger("A Dexterity modifier", dexterityModifier);
  assertInteger("A proficiency bonus", proficiency);
  assertInteger("A weapon bonus", bonus);
  const ability = weaponAbility(weapon, strengthModifier, dexterityModifier);
  const abilityModifier = ability === "strength" ? strengthModifier : dexterityModifier;
  return {
    ability,
    attackBonus: abilityModifier + proficiency + bonus,
    damage: (grip === "two-handed" ? weapon.versatileDamage : undefined) ?? weapon.damage,
    damageModifier: abilityModifier + bonus,
  };
}
