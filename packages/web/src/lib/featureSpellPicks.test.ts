import { describe, expect, it } from "vitest";
import { characterRecord } from "../test/records.ts";
import { featurePickRows, grantedByFeature } from "./featureSpellPicks.ts";

const levelled = (name: string, count: number) => {
  const class_ = { name, source: "PHB" };
  const { definition } = characterRecord("1", "Vex");
  return {
    class_,
    definition: { ...definition, levels: Array.from({ length: count }, () => ({ class: class_ })) },
  };
};

const pickedFor = (feature: string, class_: { name: string; source: string }, level: number) => ({
  kind: "classFeature" as const,
  ref: { name: feature, source: "PHB" },
  class: class_,
  level,
});

describe("grantedByFeature", () => {
  it("holds for a feature that adds a spell, not for one that marks a spell held", () => {
    const bard = levelled("Bard", 10);
    expect(grantedByFeature(bard.definition, pickedFor("Magical Secrets", bard.class_, 10))).toBe(
      true,
    );
    const wizard = levelled("Wizard", 18);
    expect(grantedByFeature(wizard.definition, pickedFor("Spell Mastery", wizard.class_, 18))).toBe(
      false,
    );
  });

  it("does not hold for a pick made for a row, or for a feature no longer held", () => {
    const bard = levelled("Bard", 9);
    expect(grantedByFeature(bard.definition, pickedFor("Magical Secrets", bard.class_, 10))).toBe(
      false,
    );
    expect(grantedByFeature(bard.definition, undefined)).toBe(false);
  });
});

describe("a homebrew effect on a feature that picks spells", () => {
  const bard = levelled("Bard", 10);
  const ruled = {
    ...bard.definition,
    homebrewEffects: new Map([
      ["Magical Secrets|PHB", [{ kind: "spells" as const, picks: [{ count: 3, from: "Bard" }] }]],
    ]),
  };
  const secrets = (definition: typeof bard.definition) =>
    featurePickRows(definition, [])
      .filter(({ feature }) => feature.name === "Magical Secrets")
      .map(({ pick }) => pick);

  it("owes the picks the effect rules in place of the recorded ones", () => {
    expect(secrets(bard.definition)).toEqual([{ count: 2, from: "any" }]);
    expect(secrets(ruled)).toEqual([{ count: 3, from: "Bard" }]);
  });

  it("marks a spell held where the effect has the feature pick from the spellbook", () => {
    const book = {
      ...bard.definition,
      homebrewEffects: new Map([
        ["Magical Secrets|PHB", [{ kind: "spells" as const, picks: [{ count: 2, from: "book" }] }]],
      ]),
    };
    expect(grantedByFeature(book, pickedFor("Magical Secrets", bard.class_, 10))).toBe(false);
  });
});
