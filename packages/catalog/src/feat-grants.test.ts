import { describe, expect, it } from "vitest";
import { featGrantsSchema } from "./index.ts";

const NONE = {
  savingThrows: [],
  skills: [],
  expertise: [],
  tools: [],
  languages: [],
  armor: [],
  weapons: [],
  resist: [],
  immune: [],
  conditionImmune: [],
  senses: [],
  offers: [],
};

describe("featGrantsSchema", () => {
  it("reads what a feat grants outright", () => {
    expect(
      featGrantsSchema.parse({
        armorProficiencies: [{ light: true, shield: true }],
        toolProficiencies: [{ "cook's utensils": true }],
        languageProficiencies: [{ sylvan: true }],
        skillProficiencies: [{ perception: true }],
        expertise: [{ perception: true }],
        resist: ["cold", "poison"],
        immune: ["poison"],
        conditionImmune: ["poisoned"],
      }),
    ).toEqual({
      ...NONE,
      armor: ["light", "shield"],
      tools: ["cook's utensils"],
      languages: ["sylvan"],
      skills: ["perception"],
      expertise: ["perception"],
      resist: ["cold", "poison"],
      immune: ["poison"],
      conditionImmune: ["poisoned"],
    });
  });

  it("reads each pick a feat offers, as Resilient, Prodigy, Skilled and Boon of Energy Resistance do", () => {
    expect(
      featGrantsSchema.parse({
        savingThrowProficiencies: [{ choose: { from: ["str", "dex"] } }],
        skillProficiencies: [{ choose: { from: ["Insight", "perception"] } }],
        toolProficiencies: [{ any: 1 }],
        languageProficiencies: [{ any: 3 }],
        expertise: [{ anyProficientSkill: 1 }],
        skillToolLanguageProficiencies: [{ choose: [{ from: ["anySkill", "anyTool"], count: 3 }] }],
        resist: [{ choose: { from: ["acid", "cold"], count: 2 } }],
      }).offers,
    ).toEqual([
      { fields: ["skills"], from: ["insight", "perception"], count: 1 },
      {
        fields: ["tools"],
        count: 1,
        from: null,
        types: ["artisan", "instrument", "gaming", "other"],
      },
      { fields: ["savingThrows"], from: ["str", "dex"], count: 1 },
      { fields: ["languages"], count: 3, from: null },
      { fields: ["expertise"], count: 1, from: null },
      { fields: ["skills", "tools"], count: 3, from: null },
      { fields: ["resist"], from: ["acid", "cold"], count: 2 },
    ]);
  });

  it("reads a pick of named languages and of named skills for expertise", () => {
    expect(
      featGrantsSchema.parse({
        languageProficiencies: [{ choose: { from: ["Elvish", "sylvan"] } }],
        expertise: [{ choose: { from: ["stealth", "perception"], count: 2 } }],
      }).offers,
    ).toEqual([
      { fields: ["languages"], from: ["elvish", "sylvan"], count: 1 },
      { fields: ["expertise"], from: ["stealth", "perception"], count: 2 },
    ]);
  });

  it("reads a tool pick of named tools and one of a kind", () => {
    expect(
      featGrantsSchema.parse({
        toolProficiencies: [{ choose: { from: ["smith's tools", "potter's tools"], count: 3 } }],
      }).offers,
    ).toEqual([{ fields: ["tools"], count: 3, from: ["smith's tools", "potter's tools"] }]);
    expect(featGrantsSchema.parse({ toolProficiencies: [{ anyArtisansTool: 1 }] }).offers).toEqual([
      { fields: ["tools"], count: 1, from: null, types: ["artisan"] },
    ]);
  });

  it("grants and offers nothing from a list of alternatives, a filter or a malformed field", () => {
    expect(
      featGrantsSchema.parse({
        languageProficiencies: [{ draconic: true }, { any: 1 }],
        weaponProficiencies: [{ choose: { fromFilter: "type=martial weapon", count: 4 } }],
        resist: "fire",
        savingThrowProficiencies: { choose: {} },
      }),
    ).toEqual(NONE);
  });
});
