import { describe, expect, it } from "vitest";
import { itemBonusSchema } from "./index.ts";

describe("itemBonusSchema", () => {
  it("reads armor class, saves and concentration saves", () => {
    expect(
      itemBonusSchema.parse({
        bonusAc: "+1",
        bonusSavingThrow: "+2",
        bonusSavingThrowConcentration: "+2",
      }),
    ).toEqual({ ac: 1, save: 2, concentration: 2 });
    expect(itemBonusSchema.parse({ bonusSavingThrow: "-2" })).toEqual({
      ac: 0,
      save: -2,
      concentration: 0,
    });
  });

  it("leaves an armor or shield bonus to the armor's own number", () => {
    expect(itemBonusSchema.parse({ type: "HA|XPHB", ac: 18, bonusAc: "+2" })).toBeUndefined();
    expect(
      itemBonusSchema.parse({ type: "S", ac: 2, bonusAc: "+1", bonusSavingThrow: "+1" }),
    ).toEqual({ ac: 0, save: 1, concentration: 0 });
  });

  it("grants nothing for a row without the fields, a potion or a malformed bonus", () => {
    expect(itemBonusSchema.parse({})).toBeUndefined();
    expect(itemBonusSchema.parse({ type: "P|XPHB", bonusAc: "+1" })).toBeUndefined();
    expect(itemBonusSchema.parse({ bonusAc: "one" })).toBeUndefined();
  });
});
