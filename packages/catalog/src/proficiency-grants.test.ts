import { describe, expect, it } from "vitest";
import { proficiencyGrantsSchema } from "./index.ts";

describe("proficiencyGrantsSchema", () => {
  it("reads what a background grants outright", () => {
    const sage = {
      name: "Sage",
      skillProficiencies: [{ arcana: true, history: true }],
      languageProficiencies: [{ anyStandard: 2 }],
      toolProficiencies: [{ "calligrapher's supplies": true }],
    };
    expect(proficiencyGrantsSchema.parse(sage)).toEqual({
      skills: ["arcana", "history"],
      languages: [],
      tools: ["calligrapher's supplies"],
      weapons: [],
      armor: [],
    });
  });

  it("drops a weapon's source and leaves a choice or an open language ungranted", () => {
    const dwarf = {
      languageProficiencies: [{ common: true, dwarvish: true, other: true }],
      weaponProficiencies: [{ "battleaxe|phb": true, "handaxe|phb": true }],
      skillProficiencies: [{ choose: { from: ["athletics", "survival"] } }],
      armorProficiencies: [{ light: true }],
    };
    expect(proficiencyGrantsSchema.parse(dwarf)).toEqual({
      skills: [],
      languages: ["common", "dwarvish"],
      tools: [],
      weapons: ["battleaxe", "handaxe"],
      armor: ["light"],
    });
  });

  it("grants nothing from a list of alternatives, which the player picks between", () => {
    const tools = [{ "disguise kit": true }, { "forgery kit": true }];
    expect(proficiencyGrantsSchema.parse({ toolProficiencies: tools }).tools).toEqual([]);
  });

  it("grants nothing from a malformed list rather than refusing the row", () => {
    expect(proficiencyGrantsSchema.parse({ skillProficiencies: "arcana" }).skills).toEqual([]);
  });
});
