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
  featureLimitedUses(held, modifiers(cha), 2).find(({ feature }) => feature.name === name);

describe("featureLimitedUses", () => {
  it("counts Action Surge once until the fighter's 17th level, then twice", () => {
    expect(usesOf(levelsOf("Fighter", "PHB", 2), "Action Surge")).toEqual({
      feature: { name: "Action Surge", source: "PHB" },
      origin: "class",
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

  it("counts Divine Sense as printed, with no use left at Charisma 8 and none below zero", () => {
    expect(usesOf(levelsOf("Paladin", "PHB", 1), "Divine Sense", -1)?.count).toBe(0);
    expect(usesOf(levelsOf("Paladin", "PHB", 1), "Divine Sense", -3)?.count).toBe(0);
  });

  it("gives Divine Sense a use at Charisma 8 under the minimumOneUse house rule", () => {
    const paladin = { ...levelsOf("Paladin", "PHB", 1), houseRules: { minimumOneUse: true } };
    expect(usesOf(paladin, "Divine Sense", -1)?.count).toBe(1);
  });

  it("keeps Bardic Inspiration's printed minimum of 1 at Charisma 8, with the house rule or without", () => {
    const bard = levelsOf("Bard", "PHB", 1);
    expect(usesOf(bard, "Bardic Inspiration", -1)?.count).toBe(1);
    const house = { ...bard, houseRules: { minimumOneUse: true } };
    expect(usesOf(house, "Bardic Inspiration", -1)?.count).toBe(1);
  });

  it("keys a feat's uses by the feat", () => {
    const lucky = {
      ...levelsOf("Fighter", "PHB", 4),
      feats: [{ ref: { name: "Lucky", source: "PHB" } }],
    };
    expect(usesOf(lucky, "Lucky")).toMatchObject({
      origin: "feat",
      level: null,
      key: "feat|PHB|Lucky",
      count: 3,
    });
  });
});
