/**
 * What a Monk's Martial Arts does to the unarmed strike and the monk weapons, read from held
 * features' `martialArts` mechanics: Dexterity offered as finesse offers it, and the class
 * table's die rolled in place of a smaller one.
 */
import { isHeavy, isLight, isTwoHanded } from "@dnd/rules";
import type { WeaponTrait } from "./catalog.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";

type MonkWeapon = Pick<WeaponTrait, "name" | "kind" | "category" | "properties">;
type Struck = Pick<WeaponTrait, "kind" | "properties" | "damage" | "versatileDamage">;

const MONK_WEAPONS = {
  classic: (weapon: MonkWeapon) =>
    weapon.name.toLowerCase() === "shortsword" ||
    (weapon.category === "simple" &&
      weapon.kind === "melee" &&
      !isTwoHanded(weapon) &&
      !isHeavy(weapon)),
  one: (weapon: MonkWeapon) =>
    weapon.kind === "melee" &&
    (weapon.category === "simple" || (weapon.category === "martial" && isLight(weapon))),
};

const POOL = /^(\d+)d(\d+)$/;

const average = (dice: string) => {
  const match = POOL.exec(dice);
  return match ? (Number(match[1]) * (Number(match[2]) + 1)) / 2 : 0;
};

/** The larger of a weapon's dice and the Martial Arts die, by average; a weapon with none keeps none. */
const larger = (dice: string | undefined, die: string | undefined) =>
  dice !== undefined && die !== undefined && average(die) > average(dice) ? die : dice;

export type MartialArts = {
  /** Whether `weapon` is a monk weapon; the unarmed strike always benefits. */
  covers: (weapon: MonkWeapon) => boolean;
  /** The weapon, or the unarmed strike, as Martial Arts lets it attack. */
  apply: <W extends Struck>(weapon: W) => W;
};

/**
 * Martial Arts as the character holds it, or null where no held feature gives it, or where
 * armor or a shield is worn or an equipped weapon is not a monk weapon, which switch it off.
 * `column` reads the class table's cell at the character's level.
 */
export function martialArts(
  definition: HoldsFeatures,
  {
    armored,
    equipped,
    column,
  }: {
    armored: boolean;
    equipped: readonly MonkWeapon[];
    column: (key: string) => string | undefined;
  },
): MartialArts | null {
  const mechanics = heldFeatures(definition).flatMap((held) =>
    mechanicsOfKind(held.entry, "martialArts"),
  );
  const [first] = mechanics;
  if (!first || armored) return null;
  const covers = MONK_WEAPONS[first.monkWeapons];
  if (!equipped.every(covers)) return null;
  const key = mechanics.find((mechanic) => mechanic.die)?.die;
  const die = key === undefined ? undefined : column(key);
  const dexterity = mechanics.some((mechanic) => mechanic.dexterity);
  return {
    covers,
    apply: (weapon) => ({
      ...weapon,
      properties: dexterity ? [...(weapon.properties ?? []), "F"] : weapon.properties,
      damage: larger(weapon.damage, die),
      versatileDamage: larger(weapon.versatileDamage, die),
    }),
  };
}
