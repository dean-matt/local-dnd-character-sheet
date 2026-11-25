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

const warMagicWizard = (edition: "classic" | "one", level: number): CharacterDefinition => ({
  ...definition,
  edition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: level }, (_, index) => ({
    class: { name: "Wizard", source: edition === "one" ? "XPHB" : "PHB" },
    ...(index === (edition === "one" ? 2 : 1)
      ? { subclass: { name: "War Magic", source: "XGE" } }
      : {}),
  })),
});

describe("a War Magic wizard", () => {
  const held = (edition: "classic" | "one", level: number) =>
    heldFeatures(warMagicWizard(edition, level)).map(({ ref }) => ref.name);

  it("holds Arcane Deflection and Tactical Wit at 2nd level of the classic wizard", () => {
    expect(held("classic", 2)).toEqual(
      expect.arrayContaining(["War Magic", "Arcane Deflection", "Tactical Wit"]),
    );
  });

  it("holds War Magic at 3rd level of the 2024 wizard", () => {
    expect(held("one", 3)).toContain("War Magic");
  });
});
