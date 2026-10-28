import { describe, expect, it } from "vitest";
import type { ClassFeatures } from "./classFeatures.ts";
import { levelHistory } from "./levelHistory.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const feature = (name: string, level: number, offeredBy?: string) => ({
  ...PHB(name),
  level,
  json: PHB(name),
  ...(offeredBy && { offeredBy: PHB(offeredBy) }),
});
const FIGHTER = PHB("Fighter");
const WIZARD = PHB("Wizard");
const FEATURES: Record<string, ClassFeatures> = {
  Fighter: {
    class: [feature("Fighting Style", 1), feature("Action Surge", 2), feature("Extra Attack", 5)],
    subclass: [feature("Improved Critical", 3), feature("Remarkable Athlete", 7)],
  },
  Wizard: { class: [feature("Spellcasting", 1), feature("Arcane Recovery", 1)], subclass: [] },
};
const featuresOf = (cls: object) =>
  "name" in cls
    ? (FEATURES[String(cls.name)] ?? { class: [], subclass: [] })
    : { class: [], subclass: [] };
const names = (rows: ReturnType<typeof levelHistory>) =>
  rows.map((row) => [row.level, row.classLevel, row.features.map(({ record }) => record.name)]);

describe("levelHistory", () => {
  it("interleaves a multiclass character's classes in the order the levels were taken", () => {
    const levels = [{ class: FIGHTER }, { class: WIZARD }, { class: FIGHTER }];
    expect(names(levelHistory(levels, featuresOf, new Map()))).toEqual([
      [1, 1, ["Fighting Style"]],
      [2, 1, ["Spellcasting", "Arcane Recovery"]],
      [3, 2, ["Action Surge"]],
    ]);
  });

  it("names the subclass at the level it was chosen, and its features from then on", () => {
    const levels = [
      { class: FIGHTER },
      { class: FIGHTER },
      { class: FIGHTER, subclass: PHB("Champion") },
      ...Array.from({ length: 4 }, () => ({ class: FIGHTER })),
    ];
    const rows = levelHistory(levels, featuresOf, new Map());
    expect(rows.map((row) => row.subclass)).toEqual([
      undefined,
      undefined,
      PHB("Champion"),
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(names(rows).map(([, , features]) => features)).toEqual([
      ["Fighting Style"],
      ["Action Surge"],
      ["Improved Critical"],
      [],
      ["Extra Attack"],
      [],
      ["Remarkable Athlete"],
    ]);
  });

  it("brings a subclass chosen late its features printed below that level", () => {
    const levels = [
      ...Array.from({ length: 4 }, () => ({ class: FIGHTER })),
      { class: FIGHTER, subclass: PHB("Champion") },
    ];
    expect(names(levelHistory(levels, featuresOf, new Map())).at(-1)).toEqual([
      5,
      5,
      ["Extra Attack", "Improved Critical"],
    ]);
  });

  it("leaves out a feature that is one option of another's choice", () => {
    const totem = {
      class: [feature("Totem Spirit", 1), feature("Bear", 1, "Totem Spirit")],
      subclass: [],
    };
    expect(names(levelHistory([{ class: PHB("Barbarian") }], () => totem, new Map()))).toEqual([
      [1, 1, ["Totem Spirit"]],
    ]);
  });

  it("names the grantor of each feature, telling a class's from its subclass's", () => {
    const paladin = {
      class: [feature("Channel Divinity", 3)],
      subclass: [feature("Channel Divinity", 3)],
    };
    const levels = [
      { class: PHB("Paladin") },
      { class: PHB("Paladin") },
      { class: PHB("Paladin"), subclass: PHB("Oath of Devotion") },
    ];
    expect(
      levelHistory(levels, () => paladin, new Map())[2]?.features.map(({ grantor, subclass }) => [
        grantor,
        subclass,
      ]),
    ).toEqual([
      ["Paladin", false],
      ["Oath of Devotion", true],
    ]);
  });
});
