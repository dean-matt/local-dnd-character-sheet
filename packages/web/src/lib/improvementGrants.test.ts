import { describe, expect, it } from "vitest";
import { grantTitle, improvementGrants } from "./improvementGrants.ts";

const WIZARD = { name: "Wizard", source: "XPHB" };
const FIGHTER = { name: "Fighter", source: "XPHB" };
const feature = (name: string, level: number) => ({ name, level });
const WIZARD_FEATURES = [
  feature("Spellcasting", 1),
  ...[4, 8, 12, 16].map((level) => feature("Ability Score Improvement", level)),
  feature("Epic Boon", 19),
];
const FIGHTER_FEATURES = [4, 6, 8].map((level) => feature("Ability Score Improvement", level));

describe("improvementGrants", () => {
  it("finds a single class's improvements and its boon at their character levels", () => {
    const levels = Array.from({ length: 20 }, () => ({ class: WIZARD }));
    expect(
      improvementGrants(levels, () => WIZARD_FEATURES).map(({ features, ...grant }) => grant),
    ).toEqual([
      { level: 4, cls: WIZARD, classLevel: 4, boon: false },
      { level: 8, cls: WIZARD, classLevel: 8, boon: false },
      { level: 12, cls: WIZARD, classLevel: 12, boon: false },
      { level: 16, cls: WIZARD, classLevel: 16, boon: false },
      { level: 19, cls: WIZARD, classLevel: 19, boon: true },
    ]);
  });

  it("counts each class's own levels when multiclassed", () => {
    const levels = [
      ...Array.from({ length: 4 }, () => ({ class: WIZARD })),
      ...Array.from({ length: 6 }, () => ({ class: FIGHTER })),
    ];
    const featuresOf = (cls: object) =>
      "name" in cls && cls.name === "Wizard" ? WIZARD_FEATURES : FIGHTER_FEATURES;
    expect(
      improvementGrants(levels, featuresOf).map(({ level, classLevel }) => [level, classLevel]),
    ).toEqual([
      [4, 4],
      [8, 4],
      [10, 6],
    ]);
  });

  it("names the features every class holds by each improvement's character level", () => {
    const levels = [
      ...Array.from({ length: 4 }, () => ({ class: FIGHTER })),
      ...Array.from({ length: 4 }, () => ({ class: WIZARD })),
    ];
    const featuresOf = (cls: object) =>
      "name" in cls && cls.name === "Wizard" ? WIZARD_FEATURES : FIGHTER_FEATURES;
    expect(improvementGrants(levels, featuresOf).map(({ features }) => features)).toEqual([
      ["Ability Score Improvement"],
      ["Ability Score Improvement", "Spellcasting", "Ability Score Improvement"],
    ]);
  });

  it("grants nothing below the first improvement or for a class with no features", () => {
    expect(improvementGrants([{ class: WIZARD }], () => WIZARD_FEATURES)).toEqual([]);
    expect(improvementGrants(Array(8).fill({ class: { homebrewId: "x" } }), () => [])).toEqual([]);
  });

  it("titles a grant by its levels, and a boon as one", () => {
    expect(grantTitle({ level: 10, cls: FIGHTER, classLevel: 6, boon: false, features: [] })).toBe(
      "Level 10 · Fighter 6",
    );
    expect(grantTitle({ level: 19, cls: WIZARD, classLevel: 19, boon: true, features: [] })).toBe(
      "Level 19 · Wizard 19 · Epic Boon",
    );
  });
});
