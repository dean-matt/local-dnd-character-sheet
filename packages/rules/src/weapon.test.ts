import { describe, expect, it } from "vitest";
import { type Weapon, weaponAttack } from "./index.ts";

const LONGSWORD: Weapon = {
  kind: "melee",
  properties: ["V"],
  damage: "1d8",
  versatileDamage: "1d10",
};
const GREATSWORD: Weapon = { kind: "melee", properties: ["2H", "H"], damage: "2d6" };
const RAPIER: Weapon = { kind: "melee", properties: ["F"], damage: "1d8" };
const SHORTBOW: Weapon = { kind: "ranged", properties: ["A", "2H"], damage: "1d6" };
const JAVELIN: Weapon = { kind: "melee", properties: ["T"], damage: "1d6" };
const DART: Weapon = { kind: "ranged", properties: ["F", "T"], damage: "1d4" };

const STRONG = {
  strengthModifier: 4,
  dexterityModifier: 1,
  proficiency: 3,
  grip: "one-handed",
} as const;
const NIMBLE = {
  strengthModifier: 1,
  dexterityModifier: 4,
  proficiency: 3,
  grip: "one-handed",
} as const;

describe("weaponAttack", () => {
  it("sums the ability modifier and the proficiency bonus", () => {
    expect(weaponAttack({ weapon: LONGSWORD, ...STRONG })).toMatchObject({
      ability: "strength",
      attackBonus: 7,
      damage: "1d8",
      damageModifier: 4,
    });
  });

  it("adds a magic weapon's bonus to the attack and the damage alike", () => {
    expect(weaponAttack({ weapon: LONGSWORD, ...STRONG, bonus: 2 })).toMatchObject({
      attackBonus: 9,
      damageModifier: 6,
    });
  });

  it("drops the proficiency bonus where the character is not proficient", () => {
    expect(weaponAttack({ weapon: LONGSWORD, ...STRONG, proficiency: 0 }).attackBonus).toBe(4);
  });

  it("takes proficiency as a number, so a halved bonus needs no second function", () => {
    expect(weaponAttack({ weapon: LONGSWORD, ...STRONG, proficiency: 1 }).attackBonus).toBe(5);
  });

  it("rolls a versatile weapon's larger die in two hands", () => {
    expect(weaponAttack({ weapon: LONGSWORD, ...STRONG, grip: "two-handed" })).toMatchObject({
      damage: "1d10",
      damageModifier: 4,
    });
  });

  it("keeps the one die of a two-handed weapon that is not versatile", () => {
    expect(weaponAttack({ weapon: GREATSWORD, ...STRONG, grip: "two-handed" }).damage).toBe("2d6");
  });

  it("leaves the damage dice for the dice parser rather than folding the modifier in", () => {
    const attack = weaponAttack({ weapon: GREATSWORD, ...STRONG });
    expect(attack.damage).toBe("2d6");
    expect(attack.damageModifier).toBe(4);
  });

  it("takes Strength for a finesse weapon where Strength is the higher", () => {
    expect(weaponAttack({ weapon: RAPIER, ...STRONG })).toMatchObject({
      ability: "strength",
      attackBonus: 7,
      damageModifier: 4,
    });
  });

  it("takes Dexterity for a finesse weapon where Dexterity is the higher", () => {
    expect(weaponAttack({ weapon: RAPIER, ...NIMBLE })).toMatchObject({
      ability: "dexterity",
      attackBonus: 7,
      damageModifier: 4,
    });
  });

  it("labels a tied finesse choice with the weapon's own ability", () => {
    expect(
      weaponAttack({
        weapon: RAPIER,
        strengthModifier: 3,
        dexterityModifier: 3,
        proficiency: 2,
        grip: "one-handed",
      }).ability,
    ).toBe("strength");
    expect(
      weaponAttack({
        weapon: DART,
        strengthModifier: 3,
        dexterityModifier: 3,
        proficiency: 2,
        grip: "one-handed",
      }).ability,
    ).toBe("dexterity");
  });

  it("takes Dexterity for a ranged weapon however strong the character", () => {
    expect(weaponAttack({ weapon: SHORTBOW, ...STRONG })).toMatchObject({
      ability: "dexterity",
      attackBonus: 4,
      damageModifier: 1,
    });
  });

  it("keeps Strength for a thrown melee weapon that is not finesse", () => {
    expect(weaponAttack({ weapon: JAVELIN, ...NIMBLE }).ability).toBe("strength");
  });

  it("reaches Strength for a ranged weapon that is also finesse", () => {
    expect(weaponAttack({ weapon: DART, ...STRONG }).ability).toBe("strength");
  });

  it("reads a finesse property upstream wraps in an object, as Lance (XPHB) wraps its 2H", () => {
    expect(
      weaponAttack({
        weapon: {
          kind: "melee",
          properties: ["H|XPHB", "R|XPHB", { uid: "F|XPHB", note: "unless mounted" }],
          damage: "1d12",
        },
        ...NIMBLE,
      }).ability,
    ).toBe("dexterity");
  });

  it.each([["F|XPHB"], ["f|xphb"]])("reads a property abbreviation spelled %s", (property) => {
    expect(weaponAttack({ weapon: { ...RAPIER, properties: [property] }, ...NIMBLE }).ability).toBe(
      "dexterity",
    );
  });

  it("ignores an abbreviation it does not know", () => {
    expect(
      weaponAttack({
        weapon: { kind: "melee", properties: ["BF", "RLD"], damage: "1d8" },
        ...NIMBLE,
      }).ability,
    ).toBe("strength");
  });

  it("treats a weapon with no properties as one with none", () => {
    expect(weaponAttack({ weapon: { kind: "melee", damage: "1d4" }, ...STRONG }).ability).toBe(
      "strength",
    );
  });

  it("returns an attack but no damage for a weapon with no dice, as Net (PHB) has none", () => {
    const attack = weaponAttack({ weapon: { kind: "ranged", properties: ["S", "T"] }, ...STRONG });
    expect(attack).toStrictEqual({ ability: "dexterity", attackBonus: 4 });
  });

  it("takes the better of two negative modifiers for a finesse weapon", () => {
    expect(
      weaponAttack({
        weapon: RAPIER,
        strengthModifier: -2,
        dexterityModifier: -1,
        proficiency: 2,
        grip: "one-handed",
      }),
    ).toMatchObject({ ability: "dexterity", attackBonus: 1, damageModifier: -1 });
  });

  it("returns a negative damage modifier rather than clamping it, so the roller sums it", () => {
    expect(
      weaponAttack({
        weapon: GREATSWORD,
        strengthModifier: -3,
        dexterityModifier: 0,
        proficiency: 2,
        grip: "two-handed",
      }),
    ).toMatchObject({ ability: "strength", attackBonus: -1, damage: "2d6", damageModifier: -3 });
  });

  it.each(["Melee", "M|XPHB", ""])("rejects a weapon kind of %o", (kind) => {
    expect(() =>
      weaponAttack({ weapon: { ...LONGSWORD, kind: kind as "melee" }, ...STRONG }),
    ).toThrow(RangeError);
  });

  it.each(["twohanded", ""])("rejects a grip of %o", (grip) => {
    expect(() =>
      weaponAttack({ weapon: LONGSWORD, ...STRONG, grip: grip as "one-handed" }),
    ).toThrow(RangeError);
  });

  it.each([
    ["strengthModifier", { strengthModifier: 1.5 }],
    ["dexterityModifier", { dexterityModifier: Number.NaN }],
    ["proficiency", { proficiency: 2.5 }],
    ["bonus", { bonus: 0.5 }],
  ])("rejects a fractional %s rather than reaching the sheet as one", (_label, part) => {
    expect(() => weaponAttack({ weapon: LONGSWORD, ...STRONG, ...part })).toThrow(RangeError);
  });
});
