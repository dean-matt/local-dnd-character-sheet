import { describe, expect, it } from "vitest";
import { classEntries, subclassEntries } from "./index.ts";

/** Fighter (PHB) as `class-fighter.json` writes it, cut to two features. */
const fighterPhb = {
  name: "Fighter",
  source: "PHB",
  hd: { number: 1, faces: 10 },
  proficiency: ["str", "con"],
  startingProficiencies: {
    skills: [{ choose: { from: ["acrobatics", "animal handling", "sleight of hand"], count: 2 } }],
    weapons: ["simple", "martial"],
    armor: ["light", "medium", "heavy", "shield"],
  },
  startingEquipment: {
    additionalFromBackground: true,
    default: ["(a) {@item chain mail|phb} or (b) {@item leather armor|phb}"],
    goldAlternative: "{@dice 5d4 × 10|5d4 × 10|Starting Gold}",
    defaultData: [],
  },
  multiclassing: {
    requirements: { or: [{ str: 13, dex: 13 }] },
    proficienciesGained: { weapons: ["simple", "martial"], armor: ["light", "medium", "shield"] },
  },
  classFeatures: [
    "Fighting Style|Fighter||1",
    "Second Wind|Fighter||1",
    { classFeature: "Martial Archetype|Fighter||3", gainSubclassFeature: true },
    "Martial Versatility|Fighter||4|TCE",
  ],
};

/** Fighter (XPHB): printed equipment prose, and a prerequisite read off its primary ability. */
const fighterXphb = {
  name: "Fighter",
  source: "XPHB",
  hd: { number: 1, faces: 10 },
  primaryAbility: [{ str: true }, { dex: true }],
  proficiency: ["str", "con"],
  startingProficiencies: { weapons: ["simple"] },
  startingEquipment: { defaultData: [], entries: ["{@i Choose A or B:} (A) gear; or (B) 155 GP"] },
  multiclassing: {},
  classFeatures: ["Second Wind|Fighter|XPHB|1"],
};

describe("classEntries", () => {
  it("shows a classic class's fields, equipment, multiclassing and level table", () => {
    expect(classEntries(fighterPhb)).toEqual([
      "{@b Hit Die} d10",
      "{@b Saving Throws} Strength, Constitution",
      "{@b Armor} Light armor, medium armor, heavy armor, shields",
      "{@b Weapons} Simple weapons, martial weapons",
      "{@b Skills} Choose 2 from Acrobatics, Animal Handling, Sleight of Hand",
      {
        type: "entries",
        name: "Starting Equipment",
        entries: [
          { type: "list", items: ["(a) {@item chain mail|phb} or (b) {@item leather armor|phb}"] },
          "Alternatively, start with {@dice 5d4 × 10|5d4 × 10|Starting Gold} gp to buy your own equipment.",
        ],
      },
      {
        type: "entries",
        name: "Multiclassing",
        entries: [
          "{@b Prerequisite} Strength 13 or Dexterity 13",
          "{@b Armor} Light armor, medium armor, shields",
          "{@b Weapons} Simple weapons, martial weapons",
        ],
      },
      {
        type: "entries",
        name: "Features",
        entries: [
          {
            type: "table",
            colLabels: ["Level", "Features"],
            rows: [
              [
                "1st",
                "{@classFeature Fighting Style|Fighter||1}, {@classFeature Second Wind|Fighter||1}",
              ],
              ["3rd", "{@classFeature Martial Archetype|Fighter||3}"],
              ["4th", "{@classFeature Martial Versatility|Fighter||4|TCE}"],
            ],
          },
        ],
      },
    ]);
  });

  it("shows a 2024 class's printed equipment and its primary ability as the prerequisite", () => {
    const entries = classEntries(fighterXphb);
    expect(entries).toContainEqual({
      type: "entries",
      name: "Starting Equipment",
      entries: ["{@i Choose A or B:} (A) gear; or (B) 155 GP"],
    });
    expect(entries).toContainEqual({
      type: "entries",
      name: "Multiclassing",
      entries: ["{@b Prerequisite} Strength 13 or Dexterity 13"],
    });
  });

  it("joins a prerequisite needing two scores, and names any-skill choices and odd proficiencies", () => {
    const entries = classEntries({
      multiclassing: { requirements: { str: 13, cha: 13 } },
      startingProficiencies: {
        skills: [{ any: 3 }],
        armor: [{ proficiency: "shield", full: "shields (not metal)" }],
        weapons: [{ proficiency: "firearms", optional: true }],
        tools: ["{@item thieves' tools|PHB}"],
      },
    });
    expect(entries).toEqual([
      "{@b Armor} Shields (not metal)",
      "{@b Weapons} Firearms (optional)",
      "{@b Tools} {@item thieves' tools|PHB}",
      "{@b Skills} Choose any 3",
      {
        type: "entries",
        name: "Multiclassing",
        entries: ["{@b Prerequisite} Strength 13 and Charisma 13"],
      },
    ]);
  });

  it("names a feature by the table name upstream gives it", () => {
    const [table] = classEntries({
      classFeatures: [{ classFeature: "Ki|Monk||2", tableDisplayName: "Monk's Focus" }],
    });
    expect(JSON.stringify(table)).toContain("{@classFeature Ki|Monk||2||Monk's Focus}");
  });

  it("is empty for a row with no field to show, and keeps a homebrew class's own prose", () => {
    expect(classEntries({ name: "Barbarian", source: "PHB" })).toEqual([]);
    expect(classEntries({ hd: { number: 1, faces: 8 }, entries: ["Brewed."] })).toEqual([
      "{@b Hit Die} d8",
      "Brewed.",
    ]);
  });
});

describe("subclassEntries", () => {
  it("lists a subclass's features by level, skipping a reference with no class level", () => {
    expect(
      subclassEntries({
        subclassFeatures: [
          "Champion|Fighter||Champion||3",
          "Remarkable Athlete|Fighter||Champion||7",
          "Broken|Fighter||Champion||",
        ],
      }),
    ).toEqual([
      {
        type: "entries",
        name: "Features",
        entries: [
          {
            type: "table",
            colLabels: ["Level", "Features"],
            rows: [
              ["3rd", "{@subclassFeature Champion|Fighter||Champion||3}"],
              ["7th", "{@subclassFeature Remarkable Athlete|Fighter||Champion||7}"],
            ],
          },
        ],
      },
    ]);
  });
});
