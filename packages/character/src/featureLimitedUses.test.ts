import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import type { Ability } from "./refs.ts";
import { definition } from "./test/vex.ts";

const levelsOf = (
  className: string,
  source: string,
  count: number,
  subclass?: { name: string; source: string },
): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, () => ({
    class: { name: className, source },
    ...(subclass && { subclass }),
  })),
});

const PROFICIENCY = 4;

const values =
  (cha: number) =>
  (term: Ability | "proficiency"): number =>
    term === "cha" ? cha : term === "int" ? 2 : term === "proficiency" ? PROFICIENCY : 0;

const usesOf = (held: CharacterDefinition, name: string, cha = 3) =>
  featureLimitedUses(held, values(cha)).find(({ feature }) => feature.name === name);

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

  it("counts Bladesong by the proficiency bonus", () => {
    const bladesinger = levelsOf("Wizard", "PHB", 2, { name: "Bladesinging", source: "TCE" });
    expect(usesOf(bladesinger, "Bladesong")).toMatchObject({
      origin: "subclass",
      count: PROFICIENCY,
      reset: "long",
    });
  });

  it("counts twice the proficiency bonus in Psionic Energy dice", () => {
    const psiWarrior = levelsOf("Fighter", "PHB", 3, { name: "Psi Warrior", source: "TCE" });
    expect(usesOf(psiWarrior, "Psionic Power")?.count).toBe(2 * PROFICIENCY);
  });

  it("counts Glorious Defense by the Charisma modifier, at least once", () => {
    const glory = levelsOf("Paladin", "PHB", 15, { name: "Oath of Glory", source: "TCE" });
    expect(usesOf(glory, "Glorious Defense")?.count).toBe(3);
    expect(usesOf(glory, "Glorious Defense", -1)?.count).toBe(1);
  });

  it("counts Harness Divine Power by cleric level, only under the optional class features rule", () => {
    const cleric = (count: number) => ({
      ...levelsOf("Cleric", "PHB", count),
      houseRules: { optionalClassFeatures: true },
    });
    const harness = "Channel Divinity: Harness Divine Power";
    expect(usesOf(cleric(5), harness)?.count).toBe(1);
    expect(usesOf(cleric(6), harness)?.count).toBe(2);
    expect(usesOf(cleric(18), harness)?.count).toBe(3);
    expect(usesOf(levelsOf("Cleric", "PHB", 6), harness)).toBeUndefined();
  });

  it("keys a pact boon's uses by the option", () => {
    const warlock = {
      ...levelsOf("Warlock", "PHB", 3),
      optionalFeatures: [
        {
          ref: { name: "Pact of the Talisman", source: "TCE" },
          featureType: "PB",
          grantedBy: { kind: "class" as const, ref: { name: "Warlock", source: "PHB" } },
        },
      ],
    };
    expect(usesOf(warlock, "Pact of the Talisman")).toMatchObject({
      origin: "optionalFeature",
      count: PROFICIENCY,
    });
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

  it("counts Limited Wish once, and leaves it to the player to restore", () => {
    const genie = levelsOf("Warlock", "PHB", 14, { name: "The Genie", source: "TCE" });
    expect(usesOf(genie, "Limited Wish")).toMatchObject({ count: 1, reset: "manual" });
  });

  it("counts a Spell-Storing Item's stored spell twice the Intelligence modifier, at least twice", () => {
    const artificer = levelsOf("Artificer", "TCE", 11);
    expect(usesOf(artificer, "Spell-Storing Item")).toMatchObject({ count: 4, reset: "long" });
    const dull = { ...artificer, houseRules: { minimumOneUse: true } };
    expect(
      featureLimitedUses(dull, () => -1).find((u) => u.feature.name === "Spell-Storing Item"),
    ).toMatchObject({ count: 2 });
  });

  const runeKnight = (fighter: number, other = 0): CharacterDefinition => ({
    ...levelsOf("Fighter", "PHB", fighter, { name: "Rune Knight", source: "TCE" }),
    levels: [
      ...levelsOf("Fighter", "PHB", fighter, { name: "Rune Knight", source: "TCE" }).levels,
      ...levelsOf("Wizard", "PHB", other).levels,
    ],
    optionalFeatures: ["Cloud Rune", "Fire Rune"].map((name) => ({
      ref: { name, source: "TCE" },
      featureType: "RN",
      grantedBy: { kind: "class" as const, ref: { name: "Fighter", source: "PHB" } },
    })),
  });

  it("counts each rune once per short rest, twice from the fighter's 15th level", () => {
    for (const rune of ["Cloud Rune", "Fire Rune"]) {
      expect(usesOf(runeKnight(14), rune)).toMatchObject({ count: 1, reset: "short" });
      expect(usesOf(runeKnight(15), rune)).toMatchObject({ count: 2, reset: "short" });
    }
  });

  it("reads the doubling from fighter levels, not the character's total", () => {
    expect(usesOf(runeKnight(14, 6), "Cloud Rune")?.count).toBe(1);
  });

  it("names what besides a rest restores Second Chance and Ghost Walk", () => {
    const chance = {
      ...levelsOf("Fighter", "PHB", 1),
      feats: [{ ref: { name: "Second Chance", source: "XGE" } }],
    } as CharacterDefinition;
    expect(usesOf(chance, "Second Chance")).toMatchObject({
      reset: "short",
      restoredBy: "initiative",
    });
    const phantom = levelsOf("Rogue", "PHB", 13, { name: "Phantom", source: "TCE" });
    expect(usesOf(phantom, "Ghost Walk")).toMatchObject({
      count: 1,
      reset: "long",
      restoredBy: "soulTrinket",
    });
  });

  it("counts Manifest Mind's casts apart from its conjuring", () => {
    const scribe = levelsOf("Wizard", "PHB", 6, { name: "Order of Scribes", source: "TCE" });
    const mind = featureLimitedUses(scribe, values(3)).filter(
      ({ feature }) => feature.name === "Manifest Mind",
    );
    expect(mind.map(({ count, part }) => [count, part])).toEqual([
      [PROFICIENCY, undefined],
      [1, "conjuring"],
    ]);
    expect(new Set(mind.map(({ key }) => key)).size).toBe(2);
  });
});
