import { describe, expect, it } from "vitest";
import { itemBonusSchema } from "./index.ts";

const noSpell = {
  spellAttack: 0,
  spellSaveDc: 0,
  spellDamage: 0,
  abilityCheck: 0,
  proficiencyBonus: 0,
  grantsProficiency: false,
  grantsLanguage: false,
};

describe("itemBonusSchema", () => {
  it("reads armor class, saves and concentration saves", () => {
    expect(
      itemBonusSchema.parse({
        bonusAc: "+1",
        bonusSavingThrow: "+2",
        bonusSavingThrowConcentration: "+2",
      }),
    ).toEqual({ ac: 1, save: 2, concentration: 2, ...noSpell });
    expect(itemBonusSchema.parse({ bonusSavingThrow: "-2" })).toEqual({
      ac: 0,
      save: -2,
      concentration: 0,
      ...noSpell,
    });
  });

  it("reads spell attack, save DC and damage bonuses", () => {
    expect(
      itemBonusSchema.parse({
        bonusSpellAttack: "+2",
        bonusSpellSaveDc: "+1",
        bonusSpellDamage: "+1",
      }),
    ).toEqual({
      ...noSpell,
      ac: 0,
      save: 0,
      concentration: 0,
      spellAttack: 2,
      spellSaveDc: 1,
      spellDamage: 1,
    });
    expect(itemBonusSchema.parse({ type: "P|XPHB", bonusSpellAttack: "+1" })).toBeUndefined();
  });

  it("reads ability check and proficiency bonuses, a critical threshold and the grant flags", () => {
    expect(
      itemBonusSchema.parse({
        bonusAbilityCheck: "-2",
        bonusProficiencyBonus: "+1",
        critThreshold: 18,
        grantsProficiency: true,
        grantsLanguage: true,
      }),
    ).toEqual({
      ...noSpell,
      ac: 0,
      save: 0,
      concentration: 0,
      abilityCheck: -2,
      proficiencyBonus: 1,
      critThreshold: 18,
      grantsProficiency: true,
      grantsLanguage: true,
    });
    expect(itemBonusSchema.parse({ critThreshold: 20 })).toBeUndefined();
  });

  it("reads each way upstream changes a speed, and drops a malformed field", () => {
    const boots = { multiply: { walk: 2 } };
    expect(itemBonusSchema.parse({ modifySpeed: boots })?.speed).toEqual(boots);
    const whistle = {
      equal: { fly: "walk" },
      multiply: { fly: 2 },
      bonus: { "*": 5 },
      static: { swim: 30 },
    };
    expect(itemBonusSchema.parse({ modifySpeed: whistle })?.speed).toEqual(whistle);
    expect(itemBonusSchema.parse({ modifySpeed: { static: { walk: "fast" } } })).toBeUndefined();
  });

  it("leaves an armor or shield bonus to the armor's own number", () => {
    expect(itemBonusSchema.parse({ type: "HA|XPHB", ac: 18, bonusAc: "+2" })).toBeUndefined();
    expect(
      itemBonusSchema.parse({ type: "S", ac: 2, bonusAc: "+1", bonusSavingThrow: "+1" }),
    ).toEqual({ ac: 0, save: 1, concentration: 0, ...noSpell });
  });

  it("grants nothing for a row without the fields, a potion or a malformed bonus", () => {
    expect(itemBonusSchema.parse({})).toBeUndefined();
    expect(itemBonusSchema.parse({ type: "P|XPHB", bonusAc: "+1" })).toBeUndefined();
    expect(itemBonusSchema.parse({ bonusAc: "one" })).toBeUndefined();
  });
});
