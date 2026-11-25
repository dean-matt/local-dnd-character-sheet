import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { speedWithFeats } from "./featEffects.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const stormSorcerer: CharacterDefinition = {
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: 18 }, (_, index) => ({
    class: { name: "Sorcerer", source: "PHB" },
    ...(index === 0 ? { subclass: { name: "Storm Sorcery", source: "XGE" } } : {}),
  })),
};

describe("a Storm sorcerer at 18th level", () => {
  it("holds Wind Soul, its short-rest use and its flying speed", () => {
    const held = heldFeatures(stormSorcerer).map(({ ref }) => ref.name);
    expect(held).toEqual(expect.arrayContaining(["Wind Soul", "Tempestuous Magic"]));
    expect(
      featureLimitedUses(stormSorcerer, () => 0)
        .filter(({ feature }) => feature.name === "Wind Soul")
        .map(({ count, reset }) => ({ count, reset })),
    ).toEqual([{ count: 1, reset: "short" }]);
    expect(speedWithFeats({ walk: 30 }, stormSorcerer, undefined).speed.fly).toBe(60);
  });
});
