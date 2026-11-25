import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
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
