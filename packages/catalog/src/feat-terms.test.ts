import { describe, expect, it } from "vitest";
import { featTermsSchema } from "./index.ts";

describe("featTermsSchema", () => {
  it("reads a 2024 feat's category, repeat and level-and-score alternatives", () => {
    expect(
      featTermsSchema.parse({
        category: "G",
        prerequisite: [
          { level: 4, ability: [{ str: 13 }] },
          { level: 4, ability: [{ dex: 13 }] },
        ],
      }),
    ).toEqual({
      category: "G",
      repeatable: false,
      prerequisites: [
        {
          level: 4,
          scores: [{ str: 13 }],
          races: [],
          proficiencies: [],
          feats: [],
          features: [],
          spell: false,
        },
        {
          level: 4,
          scores: [{ dex: 13 }],
          races: [],
          proficiencies: [],
          feats: [],
          features: [],
          spell: false,
        },
      ],
    });
    expect(featTermsSchema.parse({ category: "G", repeatable: true }).repeatable).toBe(true);
  });

  it("keeps a score list's alternatives and a level's class", () => {
    expect(
      featTermsSchema.parse({
        prerequisite: [
          { ability: [{ int: 13 }, { wis: 13 }] },
          { level: { level: 1, class: { name: "Fighter", visible: true } } },
        ],
      }).prerequisites,
    ).toEqual([
      {
        scores: [{ int: 13 }, { wis: 13 }],
        races: [],
        proficiencies: [],
        feats: [],
        features: [],
        spell: false,
      },
      {
        level: 1,
        className: "Fighter",
        scores: [],
        races: [],
        proficiencies: [],
        feats: [],
        features: [],
        spell: false,
      },
    ]);
  });

  it("reads races, proficiencies, feats, features and spellcasting, lowercased to match", () => {
    expect(
      featTermsSchema.parse({
        prerequisite: [
          { race: [{ name: "Vampire (Ixalan)" }, { name: "elf", subrace: "drow" }] },
          { proficiency: [{ armor: "heavy" }, { weaponGroup: "martial" }] },
          { feat: ["initiate of high sorcery|dsotdq|initiate of high sorcery (lunitari)"] },
          { feature: ["Fighting Style"], spellcasting2020: true },
          { spellcastingFeature: true, spellcasting: true },
        ],
      }).prerequisites,
    ).toEqual([
      {
        scores: [],
        races: [{ name: "vampire (ixalan)" }, { name: "elf", subrace: "drow" }],
        proficiencies: [],
        feats: [],
        features: [],
        spell: false,
      },
      {
        scores: [],
        races: [],
        proficiencies: [{ armor: "heavy" }, { weapon: "martial" }],
        feats: [],
        features: [],
        spell: false,
      },
      {
        scores: [],
        races: [],
        proficiencies: [],
        feats: ["initiate of high sorcery|dsotdq"],
        features: [],
        spell: false,
      },
      {
        scores: [],
        races: [],
        proficiencies: [],
        feats: [],
        features: [["Fighting Style"], ["Spellcasting", "Pact Magic"]],
        spell: false,
      },
      {
        scores: [],
        races: [],
        proficiencies: [],
        feats: [],
        features: [["Spellcasting"]],
        spell: true,
      },
    ]);
  });

  it("reads a kind it does not judge, and a race list naming a size, as needing nothing", () => {
    const none = {
      scores: [],
      races: [],
      proficiencies: [],
      feats: [],
      features: [],
      spell: false,
    };
    expect(
      featTermsSchema.parse({ prerequisite: [{ campaign: ["Eberron"] }] }).prerequisites,
    ).toEqual([none]);
    expect(
      featTermsSchema.parse({
        prerequisite: [{ race: [{ name: "dwarf" }, { name: "small race" }] }],
      }).prerequisites,
    ).toEqual([none]);
    expect(featTermsSchema.parse({}).prerequisites).toEqual([]);
  });
});
