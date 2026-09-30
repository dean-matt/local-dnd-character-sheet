/**
 * A weapon's attack bonus and damage, from a base item's own fields and the modifiers a
 * caller has already looked up.
 *
 * Which weapons a character is proficient with, and whether they are wielding one, each
 * need the whole character, so they stay in the projection over the definition and arrive
 * here as a proficiency bonus and a grip.
 */

import { assertInteger } from "./integer.ts";
import { type Breakdown, breakdown, type Term, type TermInput } from "./term.ts";

const WEAPON_KINDS = ["melee", "ranged"] as const;

type WeaponKind = (typeof WEAPON_KINDS)[number];

/** The ability a weapon attacks with. Returned so a sheet can label the number. */
type WeaponAbility = "strength" | "dexterity";

/** Which damage die a versatile weapon rolls; every other weapon rolls its one die. */
export const GRIPS = ["one-handed", "two-handed"] as const;

type Grip = (typeof GRIPS)[number];

/** Upstream spells a property as an abbreviation, or — on `Lance` (XPHB) alone — as `{uid, note}`. */
type WeaponProperty = string | { uid: string; note?: string };

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
   * The base item's `dmg1`, passed through for `@dnd/dice` to parse. Optional because
   * `Net` (PHB) carries none: it still rolls an attack, and deals no damage.
   */
  damage?: string;
  /** A versatile weapon's `dmg2`, the die it rolls in two hands. */
  versatileDamage?: string;
};

type WeaponAttackParts<Ref = unknown> = {
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
  /**
   * A magic weapon's flat bonuses, apart because upstream states them apart:
   * `bonusWeapon` adds to both rolls, `bonusWeaponAttack` and `bonusWeaponDamage` to one.
   */
  attackBonus?: TermInput<Ref>;
  damageBonus?: TermInput<Ref>;
  /**
   * Required rather than defaulted, because a versatile weapon under a default rolls its
   * smaller die and says nothing.
   */
  grip: Grip;
};

type WeaponAttack<Ref = unknown> = {
  ability: WeaponAbility;
  attack: Breakdown<Ref>;
  /**
   * `dice` is notation, beside the flat modifier rather than folded into it. Absent for a
   * weapon with no dice: a modifier on no dice is not a number a sheet can show.
   */
  damage?: { dice: string; modifier: Breakdown<Ref> };
};

const ABILITY_LABEL: Record<WeaponAbility, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
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
 * upstream types as ranged reach Dexterity by being ranged — the net outright, the dart
 * only until its own finesse offers Strength back. A tie leaves the choice moot, so the
 * weapon's own ability keeps the label steady.
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

/** A term worth nothing is left out, so a breakdown lists only what moved the total. */
function withTerm<Ref>(
  terms: Term<Ref>[],
  label: string,
  input: TermInput<Ref> | undefined,
): Term<Ref>[] {
  if (input === undefined || input.value === 0) return terms;
  return [...terms, { label, value: input.value, reference: input.reference }];
}

export function weaponAttack<Ref = unknown>({
  weapon,
  strengthModifier,
  dexterityModifier,
  proficiency,
  attackBonus,
  damageBonus,
  grip,
}: WeaponAttackParts<Ref>): WeaponAttack<Ref> {
  if (!WEAPON_KINDS.includes(weapon.kind)) {
    throw new RangeError(`Unknown weapon kind "${weapon.kind}"`);
  }
  if (!GRIPS.includes(grip)) {
    throw new RangeError(`Unknown grip "${grip}"`);
  }
  assertInteger("A Strength modifier", strengthModifier);
  assertInteger("A Dexterity modifier", dexterityModifier);
  assertInteger("A proficiency bonus", proficiency);
  assertInteger("A weapon attack bonus", attackBonus?.value ?? 0);
  assertInteger("A weapon damage bonus", damageBonus?.value ?? 0);
  const ability = weaponAbility(weapon, strengthModifier, dexterityModifier);
  const abilityTerm: Term<Ref> = {
    label: ABILITY_LABEL[ability],
    value: ability === "strength" ? strengthModifier : dexterityModifier,
  };
  const attackTerms = withTerm([abilityTerm], "Proficiency", { value: proficiency });
  const attack = { ability, attack: breakdown(withTerm(attackTerms, "Magic", attackBonus)) };
  const dice = (grip === "two-handed" ? weapon.versatileDamage : undefined) ?? weapon.damage;
  if (dice === undefined) {
    return attack;
  }
  return {
    ...attack,
    damage: { dice, modifier: breakdown(withTerm([abilityTerm], "Magic", damageBonus)) },
  };
}
