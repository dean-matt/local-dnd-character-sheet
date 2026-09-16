/**
 * A weapon's attack bonus and damage, from a base item's own fields and the modifiers a
 * caller has already looked up.
 *
 * Which weapons a character is proficient with, and whether they are wielding one, each
 * need the whole character, so they stay in the projection over the definition and arrive
 * here as a proficiency bonus and a grip.
 */

import { assertInteger } from "./integer.ts";

const WEAPON_KINDS = ["melee", "ranged"] as const;

type WeaponKind = (typeof WEAPON_KINDS)[number];

/** The ability a weapon attacks with. Returned so a sheet can label the number. */
type WeaponAbility = "strength" | "dexterity";

/** Which damage die a versatile weapon rolls; every other weapon rolls its one die. */
const GRIPS = ["one-handed", "two-handed"] as const;

type Grip = (typeof GRIPS)[number];

/** Upstream spells a property as an abbreviation, or — on `Lance` (XPHB) alone — as `{uid, note}`. */
type WeaponProperty = string | { uid: string };

export type Weapon = {
  /**
   * Derived from the base item's `type`, `M` or `R` — never its `weaponCategory`, which
   * says simple or martial and decides nothing here, and never the raw `type`, which
   * carries a source as `M|XPHB`.
   */
  kind: WeaponKind;
  /**
   * `{@itemProperty}` abbreviations as the base item spells them, source qualifier and
   * all: `F`, `V|XPHB`. Only finesse changes a number; every other abbreviation is
   * ignored.
   */
  properties?: readonly WeaponProperty[];
  /**
   * The base item's `dmg1`, passed through for `@dnd/dice` to parse. `Net` (PHB) is the
   * one weapon upstream gives none: it deals no damage, so there is nothing to pass and
   * nothing to show.
   */
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

/**
 * The abbreviation alone, from either spelling. Case is folded because `homebrew.db`
 * merges with the catalog at query time and a hand-written row is free to spell `f`;
 * every base item spells it uppercase.
 */
function abbreviation(property: WeaponProperty): string {
  const uid = typeof property === "string" ? property : property.uid;
  return uid.replace(/\|.*$/, "").toUpperCase();
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
  if (!WEAPON_KINDS.includes(weapon.kind)) {
    throw new RangeError(`Unknown weapon kind "${weapon.kind}"`);
  }
  if (!GRIPS.includes(grip)) {
    throw new RangeError(`Unknown grip "${grip}"`);
  }
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
