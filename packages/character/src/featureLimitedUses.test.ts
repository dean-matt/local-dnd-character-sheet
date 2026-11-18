import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import type { Ability } from "./refs.ts";
import { definition } from "./test/vex.ts";

const levelsOf = (className: string, source: string, count: number): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, () => ({ class: { name: className, source } })),
});

const modifiers =
  (cha: number) =>
  (ability: Ability): number =>
    ability === "cha" ? cha : 0;

const usesOf = (held: CharacterDefinition, name: string, cha = 3) =>
  featureLimitedUses(held, modifiers(cha)).find(({ feature }) => feature.name === name);

describe("featureLimitedUses", () => {
  it("counts Action Surge once until the fighter's 17th level, then twice", () => {
    expect(usesOf(levelsOf("Fighter", "PHB", 2), "Action Surge")).toEqual({
      feature: { name: "Action Surge", source: "PHB" },
      level: 2,
      key: "feature|Fighter|PHB|||2|PHB|Action Surge",
      count: 1,
      reset: "short",
    });
    expect(usesOf(levelsOf("Fighter", "PHB", 17), "Action Surge")?.count).toBe(2);
  });

  it("counts Bardic Inspiration by the Charisma modifier, at least once, and resets it on a short rest from 5th level", () => {
    expect(usesOf(levelsOf("Bard", "PHB", 4), "Bardic Inspiration")).toMatchObject({
      count: 3,
      reset: "long",
    });
    expect(usesOf(levelsOf("Bard", "PHB", 4), "Bardic Inspiration", -1)?.count).toBe(1);
    expect(usesOf(levelsOf("Bard", "PHB", 5), "Bardic Inspiration")?.reset).toBe("short");
  });

  it("counts Divine Sense as 1 plus the Charisma modifier", () => {
    expect(usesOf(levelsOf("Paladin", "PHB", 1), "Divine Sense", 2)?.count).toBe(3);
  });

  it("keys a feat's uses by the feat", () => {
    const lucky = {
      ...levelsOf("Fighter", "PHB", 4),
      feats: [{ ref: { name: "Lucky", source: "PHB" } }],
    };
    expect(usesOf(lucky, "Lucky")).toMatchObject({ level: null, key: "feat|PHB|Lucky", count: 3 });
  });
});
