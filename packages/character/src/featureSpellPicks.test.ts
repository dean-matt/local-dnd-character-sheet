import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { classFeatureGrantor, featureSpellPicks } from "./featureSpellPicks.ts";
import { definition } from "./test/vex.ts";

const BARD = { name: "Bard", source: "PHB" };
const WARLOCK = { name: "Warlock", source: "PHB" };

const holding = (extra: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  ...extra,
});

const levels = (owner: { name: string; source: string }, count: number) =>
  Array.from({ length: count }, () => ({ class: owner }));

describe("featureSpellPicks", () => {
  it("offers a Warlock's Mystic Arcanum for each level it has reached", () => {
    const names = (count: number) =>
      featureSpellPicks(holding({ levels: levels(WARLOCK, count) })).map(
        ({ feature }) => feature.name,
      );

    expect(names(10)).toEqual([]);
    expect(names(13)).toEqual(["Mystic Arcanum (6th level)", "Mystic Arcanum (7th level)"]);
  });

  it("offers each Magical Secrets of a Bard as its own row", () => {
    const rows = featureSpellPicks(holding({ levels: levels(BARD, 14) })).filter(
      ({ feature }) => feature.name === "Magical Secrets",
    );

    expect(rows.map(({ feature }) => feature.level)).toEqual([10, 14]);
    expect(rows[0]?.picks).toEqual([{ count: 2, from: "any" }]);
  });

  it("offers a subclass feature only to the subclass", () => {
    const lore = featureSpellPicks(
      holding({
        levels: [
          ...levels(BARD, 2),
          { class: BARD, subclass: { name: "College of Lore", source: "PHB" } },
          ...levels(BARD, 3),
        ],
      }),
    );

    expect(lore.map(({ feature }) => feature.name)).toContain("Additional Magical Secrets");
    expect(
      featureSpellPicks(holding({ levels: levels(BARD, 6) })).map(({ feature }) => feature.name),
    ).not.toContain("Additional Magical Secrets");
  });
});

describe("classFeatureGrantor", () => {
  it("names the class, level and subclass a feature is recorded under", () => {
    expect(
      classFeatureGrantor({
        name: "Additional Magical Secrets",
        source: "PHB",
        className: "Bard",
        classSource: "PHB",
        subclass: { shortName: "Lore", source: "PHB" },
        level: 6,
      }),
    ).toEqual({
      kind: "classFeature",
      ref: { name: "Additional Magical Secrets", source: "PHB" },
      class: BARD,
      level: 6,
      subclass: { shortName: "Lore", source: "PHB" },
    });
  });
});
