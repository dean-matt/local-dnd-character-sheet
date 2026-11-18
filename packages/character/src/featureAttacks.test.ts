import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import {
  type DamageSheet,
  featureAttackEffects,
  featureDamage,
  featureDamageDice,
  featureStrike,
  type Strike,
} from "./featureAttacks.ts";
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

describe("featureDamage", () => {
  const sheet = (cells: Record<string, string> = {}, raging = false): DamageSheet => ({
    column: (key) => cells[key],
    modifier: (ability) => (ability === "cha" ? 3 : 0),
    raging,
  });
  const sources = (definition: CharacterDefinition, strike: Strike, on = sheet()) =>
    featureDamage(definition, strike, on).map(({ source, dice, bonus }) => ({
      source,
      dice,
      bonus,
    }));

  it("offers Sneak Attack on finesse and ranged weapons alone, at the table's dice", () => {
    const rogue = levelsOf("Rogue", "XPHB", 3);
    const cells = sheet({ sneak_attack: "2d6" });
    expect(sources(rogue, RAPIER, cells)).toEqual([
      { source: "Sneak Attack", dice: "2d6", bonus: 0 },
    ]);
    expect(sources(rogue, LONGBOW, cells)).toHaveLength(1);
    expect(sources(rogue, GREATSWORD, cells)).toEqual([]);
    expect(sources(rogue, UNARMED, cells)).toEqual([]);
  });

  it("scales Divine Strike's dice at the 14th level of its class", () => {
    const life = (level: number) => levelsOf("Cleric", "PHB", level, "Life Domain");
    expect(sources(life(8), GREATSWORD)).toEqual([
      { source: "Divine Strike", dice: "1d8", bonus: 0 },
    ]);
    expect(sources(life(14), UNARMED)).toEqual([
      { source: "Divine Strike", dice: "2d8", bonus: 0 },
    ]);
    expect(sources(life(7), GREATSWORD)).toEqual([]);
  });

  it("rolls Frenzy's d6s, as many as the Rage Damage cell, only during a rage", () => {
    const berserker = levelsOf("Barbarian", "XPHB", 3, "Path of the Berserker");
    const cells = { rage_damage: "+2" };
    expect(sources(berserker, GREATSWORD, sheet(cells, true))).toEqual([
      { source: "Frenzy", dice: "2d6", bonus: 0 },
    ]);
    expect(sources(berserker, GREATSWORD, sheet(cells))).toEqual([]);
  });

  it("adds Lifedrinker's Charisma modifier as a flat amount", () => {
    const warlock = character({
      optionalFeatures: [{ featureType: "EI", ref: { name: "Lifedrinker", source: "PHB" } }],
    } as Partial<CharacterDefinition>);
    expect(featureDamage(warlock, GREATSWORD, sheet())).toEqual([
      {
        source: "Lifedrinker",
        dice: null,
        bonus: 3,
        type: "necrotic",
        offer: { condition: "with your pact weapon", oncePerTurn: false, slot: null },
      },
    ]);
  });
});

describe("featureDamageDice", () => {
  const smite = {
    source: "Divine Smite",
    dice: "2d8",
    bonus: 0,
    type: "radiant",
    offer: {
      condition: "on a melee weapon hit",
      oncePerTurn: false,
      slot: { max: 5, versus: "an undead or a fiend" },
    },
  };

  it("adds a die for each slot level past the first, up to the maximum, and one versus", () => {
    expect(featureDamageDice(smite, 1)).toBe("2d8");
    expect(featureDamageDice(smite, 3)).toBe("4d8");
    expect(featureDamageDice(smite, 5)).toBe("5d8");
    expect(featureDamageDice(smite, 5, true)).toBe("6d8");
  });

  it("leaves dice that spend no slot as they are", () => {
    expect(featureDamageDice({ ...smite, offer: null }, 3)).toBe("2d8");
    expect(featureDamageDice({ ...smite, dice: null, bonus: 3 })).toBeNull();
  });
});
