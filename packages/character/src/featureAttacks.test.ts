import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureAttackEffects, featureStrike, type Strike } from "./featureAttacks.ts";
import { effectsOnRoll } from "./rollEffects.ts";
import { definition } from "./test/vex.ts";

const character = (extra: Partial<CharacterDefinition> = {}): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  ...extra,
});

const levelsOf = (className: string, source: string, count: number, subclass?: string) =>
  character({
    levels: Array.from({ length: count }, (_, index) => ({
      class: { name: className, source },
      ...(index === 0 && subclass ? { subclass: { name: subclass, source } } : {}),
    })),
  });

const withFeat = (name: string, source = "PHB") =>
  character({ feats: [{ ref: { name, source } }] });

const LONGBOW: Strike = {
  weapon: { kind: "ranged", properties: ["H", "2H"] },
  proficient: true,
  alone: false,
};
const RAPIER: Strike = {
  weapon: { kind: "melee", properties: ["F"] },
  proficient: true,
  alone: true,
};
const GREATSWORD: Strike = {
  weapon: { kind: "melee", properties: ["H", "2H"] },
  proficient: true,
  alone: false,
};
const UNARMED: Strike = { proficient: true, alone: false };

describe("featureStrike", () => {
  it("adds Archery to ranged attacks alone, named for the feature", () => {
    const archer = character({
      optionalFeatures: [{ featureType: "FS:F", ref: { name: "Archery", source: "PHB" } }],
    } as Partial<CharacterDefinition>);
    expect(featureStrike(archer, LONGBOW).attack).toEqual([
      { label: "Archery", value: 2, reference: { name: "Archery", source: "PHB" } },
    ]);
    expect(featureStrike(archer, RAPIER).attack).toEqual([]);
    expect(featureStrike(archer, UNARMED).attack).toEqual([]);
  });

  it("adds Dueling to the damage of a melee weapon held alone in one hand", () => {
    const duelist = withFeat("Dueling", "XPHB");
    expect(featureStrike(duelist, RAPIER).damage).toEqual([
      { label: "Dueling", value: 2, reference: { name: "Dueling", source: "XPHB" } },
    ]);
    expect(featureStrike(duelist, { ...RAPIER, alone: false }).damage).toEqual([]);
  });

  it("lowers the critical threshold to the lowest a Champion's features give, on every attack", () => {
    expect(
      featureStrike(levelsOf("Fighter", "PHB", 2, "Champion"), UNARMED).critical,
    ).toBeUndefined();
    expect(featureStrike(levelsOf("Fighter", "PHB", 3, "Champion"), LONGBOW).critical).toEqual({
      label: "Improved Critical",
      value: 19,
    });
    expect(featureStrike(levelsOf("Fighter", "XPHB", 15, "Champion"), UNARMED).critical).toEqual({
      label: "Superior Critical",
      value: 18,
    });
  });

  it("offers Sharpshooter and Great Weapon Master's trade on a proficient weapon of their kind, never as a term", () => {
    const trade = (source: string) => [
      { source, attack: -5, damage: 10, condition: expect.any(String) },
    ];
    const sharpshooter = featureStrike(withFeat("Sharpshooter"), LONGBOW);
    expect(sharpshooter.options).toEqual(trade("Sharpshooter"));
    expect(sharpshooter.attack).toEqual([]);
    expect(
      featureStrike(withFeat("Sharpshooter"), { ...LONGBOW, proficient: false }).options,
    ).toEqual([]);
    expect(featureStrike(withFeat("Great Weapon Master"), GREATSWORD).options).toEqual(
      trade("Great Weapon Master"),
    );
    expect(featureStrike(withFeat("Great Weapon Master"), RAPIER).options).toEqual([]);
    expect(featureStrike(withFeat("Great Weapon Master"), LONGBOW).options).toEqual([]);
  });
});

describe("featureAttackEffects", () => {
  it("offers Reckless Attack's advantage on Strength attacks as a condition the player ticks", () => {
    const effects = featureAttackEffects(levelsOf("Barbarian", "PHB", 2));
    expect(effectsOnRoll(effects, { roll: "attack", ability: "str" })).toEqual([
      {
        source: "Reckless Attack",
        mode: "advantage",
        roll: "attack",
        target: "str",
        condition: expect.any(String),
      },
    ]);
    expect(effectsOnRoll(effects, { roll: "attack", ability: "dex" })).toEqual([]);
    expect(featureAttackEffects(levelsOf("Barbarian", "PHB", 1))).toEqual([]);
  });

  it("offers Grappler's advantage on every attack", () => {
    const effects = featureAttackEffects(withFeat("Grappler"));
    expect(effectsOnRoll(effects, { roll: "attack", ability: "dex" })).toEqual([
      expect.objectContaining({ source: "Grappler", condition: expect.any(String) }),
    ]);
  });
});
