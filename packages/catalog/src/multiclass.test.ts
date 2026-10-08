import { describe, expect, it } from "vitest";
import {
  classProficiencyGrantsSchema,
  classSkillChoiceSchema,
  classToolChoicesSchema,
  multiclassEntrySchema,
  multiclassPrerequisiteSchema,
} from "./index.ts";

describe("multiclassEntrySchema", () => {
  it("reads what a class grants on multiclassing in through the starting schemas, with no saves", () => {
    const rogue = {
      proficiency: ["dex", "int"],
      startingProficiencies: { armorProficiencies: [{ light: true }], weapons: ["simple"] },
      multiclassing: {
        proficienciesGained: {
          skills: [{ choose: { from: ["acrobatics", "stealth"], count: 1 } }],
          toolProficiencies: [{ "thieves' tools": true }],
          armorProficiencies: [{ light: true }],
        },
      },
    };
    const entry = multiclassEntrySchema.parse(rogue);

    expect(classProficiencyGrantsSchema.parse(entry)).toEqual({
      savingThrows: [],
      skills: [],
      languages: [],
      tools: ["thieves' tools"],
      weapons: [],
      armor: ["light"],
    });
    expect(classSkillChoiceSchema.parse(entry)).toEqual({
      from: ["acrobatics", "stealth"],
      count: 1,
    });
  });

  it("grants nothing for a class that writes no gains or an empty multiclassing", () => {
    for (const row of [{}, { multiclassing: {} }, { multiclassing: "malformed" }]) {
      const entry = multiclassEntrySchema.parse(row);
      expect(classProficiencyGrantsSchema.parse(entry).armor).toEqual([]);
      expect(classToolChoicesSchema.parse(entry)).toEqual([]);
    }
  });
});

describe("multiclassPrerequisiteSchema", () => {
  it("reads a classic row's requirements, each key under `or` an alternative", () => {
    const paladin = { multiclassing: { requirements: { str: 13, cha: 13 } } };
    const fighter = { multiclassing: { requirements: { or: [{ str: 13, dex: 13 }] } } };

    expect(multiclassPrerequisiteSchema.parse(paladin)).toEqual([{ str: 13, cha: 13 }]);
    expect(multiclassPrerequisiteSchema.parse(fighter)).toEqual([{ str: 13 }, { dex: 13 }]);
  });

  it("reads a 2024 row's primary ability as 13 in each, as alternatives", () => {
    const fighter = { multiclassing: {}, primaryAbility: [{ str: true }, { dex: true }] };
    const monk = { primaryAbility: [{ dex: true, wis: true }] };

    expect(multiclassPrerequisiteSchema.parse(fighter)).toEqual([{ str: 13 }, { dex: 13 }]);
    expect(multiclassPrerequisiteSchema.parse(monk)).toEqual([{ dex: 13, wis: 13 }]);
  });

  it("needs nothing where the row names no ability, or names one malformed", () => {
    expect(multiclassPrerequisiteSchema.parse({})).toEqual([]);
    expect(multiclassPrerequisiteSchema.parse({ primaryAbility: "int" })).toEqual([]);
    expect(
      multiclassPrerequisiteSchema.parse({ multiclassing: { requirements: { luck: 13 } } }),
    ).toEqual([]);
  });
});
