import {
  appliedBackgroundFieldsSchema,
  appliedClassFieldsSchema,
  appliedFeatFieldsSchema,
  classEntries,
  featGrantsSchema,
  featTermsSchema,
  rowEntries,
  spellcastingAbilitySchema,
} from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { backgroundFacts, classFacts, featFacts, raceFacts } from "./homebrewOptionFacts.ts";
import { BACKGROUND_STARTERS, CLASS_STARTERS, FEAT_STARTERS } from "./homebrewStarters.ts";

const recording = () => {
  const read = new Set<string>();
  const recorded = (entry: Record<string, unknown>) =>
    new Proxy(entry, {
      get(target, key, receiver) {
        if (typeof key === "string") read.add(key);
        return Reflect.get(target, key, receiver);
      },
    });
  return { read, recorded };
};

describe("homebrewOptionFacts", () => {
  it("names a varying size, a walking speed and fixed increases, a decrease signed as written", () => {
    expect(
      raceFacts({ size: ["V"], speed: { walk: 25, fly: 30 }, ability: [{ str: 2, int: -2 }] }),
    ).toEqual([
      ["Size", "Small or Medium"],
      ["Speed", "25 ft."],
      ["Ability Scores", "+2 STR -2 INT"],
    ]);
  });

  it("leaves a race's increases to its rules text where it offers more than one way", () => {
    expect(raceFacts({ size: ["M"], speed: 30, ability: [{ str: 2 }, { con: 2 }] })).toEqual([
      ["Size", "Medium"],
      ["Speed", "30 ft."],
    ]);
  });

  it("leaves out what an entry does not state", () => {
    expect(raceFacts({ name: "Blank" })).toEqual([]);
    expect(classFacts({ name: "Blank" })).toEqual([]);
    expect(backgroundFacts({ skillProficiencies: [{ choose: { from: ["arcana"] } }] })).toEqual([]);
    expect(featFacts({ name: "Blank" })).toEqual([]);
  });

  it("reads a class's primary ability as alternatives, each naming the abilities it needs together", () => {
    expect(
      classFacts({
        hd: { number: 1, faces: 8 },
        proficiency: ["dex", "int"],
        primaryAbility: [{ dex: true, wis: true }, { str: true }],
      }),
    ).toEqual([
      ["Hit Die", "d8"],
      ["Primary Ability", "DEX and WIS or STR"],
      ["Saving Throws", "DEX/INT"],
    ]);
  });

  it("joins a feat's prerequisite alternatives, each listing every part it needs", () => {
    expect(
      featFacts({
        prerequisite: [
          { level: 4, ability: [{ str: 13 }, { dex: 13 }] },
          { race: [{ name: "elf", subrace: "drow" }], spellcasting: true },
        ],
      }),
    ).toEqual([["Prerequisite", "Level 4, STR 13 or DEX 13; or Elf (Drow), Spellcasting"]]);
  });

  it("names armor and weapon proficiency prerequisites by kind", () => {
    expect(
      featFacts({ prerequisite: [{ proficiency: [{ armor: "heavy" }, { weapon: "martial" }] }] }),
    ).toEqual([["Prerequisite", "Heavy armor proficiency or Martial weapon proficiency"]]);
  });

  it("names no prerequisite where an alternative names only what the sheet reads as met", () => {
    expect(
      featFacts({
        prerequisite: [{ background: [{ name: "Rune Carver" }] }],
      }),
    ).toEqual([]);
  });
  it("reads nothing off a homebrew class that the class's field reference leaves out", () => {
    const { read, recorded } = recording();
    const entry = {
      ...CLASS_STARTERS[0].entry,
      spellcastingAbility: "wis",
      startingProficiencies: { armor: ["light"], skills: [{ choose: { from: ["nature"] } }] },
      startingEquipment: { default: ["a club"], goldAlternative: "50" },
      multiclassing: { requirements: { str: 13 }, proficienciesGained: { armor: ["light"] } },
      classFeatures: ["Grove Ward|Warden|Homebrew|1"],
    };
    classEntries(recorded(entry));
    classFacts(recorded(entry));
    spellcastingAbilitySchema.parse(recorded(entry));
    expect([...read].filter((key) => !(key in appliedClassFieldsSchema.shape))).toEqual([]);
  });
  it("reads nothing off a homebrew background that the background's field reference leaves out", () => {
    const { read, recorded } = recording();
    const entry = { ...BACKGROUND_STARTERS[0].entry, entriesHigherLevel: ["More."] };
    rowEntries(recorded(entry));
    backgroundFacts(recorded(entry));
    expect([...read].filter((key) => !(key in appliedBackgroundFieldsSchema.shape))).toEqual([]);
  });
  it("reads nothing off a homebrew feat that the feat's field reference leaves out", () => {
    const { read, recorded } = recording();
    const entry = {
      ...FEAT_STARTERS[0].entry,
      entriesHigherLevel: ["More."],
      category: "O",
      repeatable: true,
      savingThrowProficiencies: [{ choose: { from: ["str", "dex"] } }],
      expertise: [{ anyProficientSkill: 1 }],
      skillProficiencies: [{ perception: true }],
      languageProficiencies: [{ any: 1 }],
      toolProficiencies: [{ anyArtisansTool: 1 }],
      weaponProficiencies: [{ martial: true }],
      armorProficiencies: [{ heavy: true }],
      skillToolLanguageProficiencies: [{ choose: [{ from: ["anySkill", "anyTool"], count: 3 }] }],
      resist: ["fire", { choose: { from: ["cold", "acid"] } }],
      immune: ["poison"],
      conditionImmune: ["charmed"],
      darkvision: 60,
      senses: [{ blindsight: 10 }],
    };
    rowEntries(recorded(entry));
    featFacts(recorded(entry));
    featGrantsSchema.parse(recorded(entry));
    featTermsSchema.parse(recorded(entry));
    expect([...read].filter((key) => !(key in appliedFeatFieldsSchema.shape))).toEqual([]);
  });
});
