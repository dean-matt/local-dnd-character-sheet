import { describe, expect, it } from "vitest";
import { classProficiencyGrantsSchema, proficiencyGrantsSchema } from "./index.ts";

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

describe("classProficiencyGrantsSchema", () => {
  it("reads a class's saving throws, armor, tools and the weapons its tags name", () => {
    const rogue = {
      proficiency: ["dex", "int"],
      startingProficiencies: {
        skills: [{ choose: { from: ["acrobatics", "stealth"], count: 4 } }],
        weapons: ["simple", "{@item hand crossbow|phb|hand crossbows}"],
        toolProficiencies: [{ "thieves' tools": true }],
        armorProficiencies: [{ light: true }],
      },
    };
    expect(classProficiencyGrantsSchema.parse(rogue)).toEqual({
      savingThrows: ["dex", "int"],
      skills: [],
      languages: [],
      tools: ["thieves' tools"],
      weapons: ["simple", "hand crossbow"],
      armor: ["light"],
    });
  });

  it("grants no weapon from prose or an optional grant", () => {
    const monk = {
      startingProficiencies: {
        weapons: [
          "simple",
          "Martial weapons that have the {@filter Light|items|property=light} property",
          { proficiency: "firearms", optional: true },
        ],
      },
    };
    expect(classProficiencyGrantsSchema.parse(monk).weapons).toEqual(["simple"]);
  });

  it("grants nothing from a row that states no proficiencies", () => {
    expect(classProficiencyGrantsSchema.parse({ name: "Mystery" })).toMatchObject({
      savingThrows: [],
      weapons: [],
      armor: [],
    });
  });
});
