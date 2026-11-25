import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const warlock = (subclass: string, level: number): CharacterDefinition => ({
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: level }, (_, index) => ({
    class: { name: "Warlock", source: "PHB" },
    ...(index === 0 ? { subclass: { name: subclass, source: "PHB" } } : {}),
  })),
});

describe("a classic Fiend warlock at 14th level", () => {
  const fiend = warlock("The Fiend", 14);

  it("holds Hurl Through Hell and counts its use per long rest", () => {
    expect(heldFeatures(fiend).map(({ ref }) => ref.name)).toContain("Hurl Through Hell");
    expect(
      featureLimitedUses(fiend, () => 0)
        .filter(({ feature }) => feature.name === "Hurl Through Hell")
        .map(({ count, reset }) => ({ count, reset })),
    ).toEqual([{ count: 1, reset: "long" }]);
  });

  it("counts Dark One's Own Luck per short rest", () => {
    expect(
      featureLimitedUses(fiend, () => 0)
        .filter(({ feature }) => feature.name === "Dark One's Own Luck")
        .map(({ count, reset }) => ({ count, reset })),
    ).toEqual([{ count: 1, reset: "short" }]);
  });
});

describe("the PHB Wizard and Warlock records", () => {
  const record = (name: string, subclass: string) => {
    const found = FEATURE_MECHANICS.find(
      ({ ref }) => ref.name === name && "subclass" in ref && ref.subclass?.shortName === subclass,
    );
    if (!found) throw new Error(`no record for ${name}`);
    return found;
  };

  it("words Spell Resistance as advantage against spells", () => {
    expect(mechanicsOfKind(record("Spell Resistance", "Abjuration"), "roll")).toEqual([
      expect.objectContaining({ roll: "save", advantage: true, against: "against spells" }),
    ]);
  });

  it.each([
    ["Illusory Self", "Illusion"],
    ["Shapechanger", "Transmutation"],
    ["Misty Escape", "Archfey"],
  ])("counts %s per short rest", (name, subclass) => {
    expect(mechanicsOfKind(record(name, subclass), "uses")).toEqual([
      expect.objectContaining({ reset: "short" }),
    ]);
  });
});
