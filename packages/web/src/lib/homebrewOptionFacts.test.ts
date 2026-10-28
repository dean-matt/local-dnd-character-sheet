import { describe, expect, it } from "vitest";
import { backgroundFacts, classFacts, featFacts, raceFacts } from "./homebrewOptionFacts.ts";

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
});
