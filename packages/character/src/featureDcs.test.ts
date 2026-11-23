import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { type DcSheet, featureDcs } from "./featureDcs.ts";
import { definition } from "./test/vex.ts";

const dc = (computed: number) => ({ computed, manual: null, terms: [] });

const SHEET: DcSheet = {
  modifier: (ability) => ({ str: 3, dex: 3, con: 1, int: 0, wis: 4, cha: 2 })[ability],
  ability: (ability) => dc({ str: 14, dex: 14, con: 12, int: 11, wis: 15, cha: 13 }[ability]),
  spell: (className) => (className === "Cleric" ? dc(16) : undefined),
};

const levelsOf = (
  className: string,
  count: number,
  subclass?: { name: string; source: string },
): CharacterDefinition => ({
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: className, source: "PHB" },
    ...(index === 0 && subclass ? { subclass } : {}),
  })),
});

const dcsOf = (held: CharacterDefinition, name: string) =>
  featureDcs(held, SHEET).filter(({ feature }) => feature.name === name);

describe("featureDcs", () => {
  it("sets the Ki DC from Wisdom, and Stunning Strike's from the same ki", () => {
    const monk = levelsOf("Monk", 5);
    expect(dcsOf(monk, "Ki")).toEqual([
      { feature: { name: "Ki", source: "PHB" }, label: "Ki", saveDc: dc(15) },
    ]);
    expect(dcsOf(monk, "Stunning Strike")).toMatchObject([{ label: "Ki", saveDc: dc(15) }]);
  });

  it("sets a maneuver DC from the higher of Strength and Dexterity, the first on a tie", () => {
    const master = levelsOf("Fighter", 3, { name: "Battle Master", source: "PHB" });
    expect(dcsOf(master, "Combat Superiority")).toMatchObject([
      { label: "Maneuver", saveDc: dc(14) },
    ]);
    const nimble: DcSheet = {
      ...SHEET,
      modifier: (ability) => (ability === "dex" ? 4 : 1),
      ability: (ability) => dc(ability === "dex" ? 15 : 12),
    };
    expect(
      featureDcs(master, nimble).find(({ feature }) => feature.name === "Combat Superiority"),
    ).toMatchObject({ saveDc: dc(15) });
  });

  it("takes a class's spell save DC, once however many levels record the feature, and none where the class does not cast", () => {
    const cleric = levelsOf("Cleric", 6, { name: "Light Domain", source: "PHB" });
    expect(dcsOf(cleric, "Channel Divinity")).toMatchObject([{ saveDc: dc(16) }]);
    expect(dcsOf(cleric, "Channel Divinity: Radiance of the Dawn")).toHaveLength(1);
    expect(featureDcs(levelsOf("Cleric", 6), { ...SHEET, spell: () => undefined })).toEqual([]);
  });

  it("sets no DC until the character reaches the level that holds the feature", () => {
    expect(dcsOf(levelsOf("Monk", 1), "Ki")).toEqual([]);
    expect(dcsOf(levelsOf("Fighter", 5), "Combat Superiority")).toEqual([]);
  });
});
