import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import {
  type DamageSheet,
  featureAttackEffects,
  featureDamage,
  featureDamageDice,
  featureStrike,
  offerSlots,
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

const levelsOf = (
  className: string,
  source: string,
  count: number,
  subclass?: string,
  subclassSource = source,
) =>
  character({
    levels: Array.from({ length: count }, (_, index) => ({
      class: { name: className, source },
      ...(index === 0 && subclass ? { subclass: { name: subclass, source: subclassSource } } : {}),
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
const DAGGER: Strike = {
  weapon: { kind: "melee", properties: ["F", "L", "T"] },
  proficient: true,
  alone: true,
};

describe("featureStrike", () => {
  it("adds Archery to ranged attacks alone, named for the feature", () => {
    const archer = character({
      optionalFeatures: [{ featureType: "FS:F", ref: { name: "Archery", source: "PHB" } }],
    } as Partial<CharacterDefinition>);
    expect(featureStrike(archer, LONGBOW, () => 0).attack).toEqual([
      { label: "Archery", value: 2, reference: { name: "Archery", source: "PHB" } },
    ]);
    expect(featureStrike(archer, RAPIER, () => 0).attack).toEqual([]);
    expect(featureStrike(archer, UNARMED, () => 0).attack).toEqual([]);
  });

  it("adds Dueling to the damage of a melee weapon held alone in one hand", () => {
    const duelist = withFeat("Dueling", "XPHB");
    expect(featureStrike(duelist, RAPIER, () => 0).damage).toEqual([
      { label: "Dueling", value: 2, reference: { name: "Dueling", source: "XPHB" } },
    ]);
    expect(featureStrike(duelist, { ...RAPIER, alone: false }, () => 0).damage).toEqual([]);
  });

  it("lowers the critical threshold to the lowest a Champion's features give, on every attack", () => {
    expect(
      featureStrike(levelsOf("Fighter", "PHB", 2, "Champion"), UNARMED, () => 0).critical,
    ).toBeUndefined();
    expect(
      featureStrike(levelsOf("Fighter", "PHB", 3, "Champion"), LONGBOW, () => 0).critical,
    ).toEqual({
      label: "Improved Critical",
      value: 19,
    });
    expect(
      featureStrike(levelsOf("Fighter", "XPHB", 15, "Champion"), UNARMED, () => 0).critical,
    ).toEqual({
      label: "Superior Critical",
      value: 18,
    });
  });

  it("offers Sharpshooter and Great Weapon Master's trade on a proficient weapon of their kind, never as a term", () => {
    const trade = (source: string) => [
      { source, attack: -5, damage: 10, critical: null, condition: expect.any(String) },
    ];
    const sharpshooter = featureStrike(withFeat("Sharpshooter"), LONGBOW, () => 0);
    expect(sharpshooter.options).toEqual(trade("Sharpshooter"));
    expect(sharpshooter.attack).toEqual([]);
    expect(
      featureStrike(withFeat("Sharpshooter"), { ...LONGBOW, proficient: false }, () => 0).options,
    ).toEqual([]);
    expect(featureStrike(withFeat("Great Weapon Master"), GREATSWORD, () => 0).options).toEqual(
      trade("Great Weapon Master"),
    );
    expect(featureStrike(withFeat("Great Weapon Master"), RAPIER, () => 0).options).toEqual([]);
    expect(featureStrike(withFeat("Great Weapon Master"), LONGBOW, () => 0).options).toEqual([]);
  });
});

describe("featureStrike, outside the SRD", () => {
  const offered = (definition: CharacterDefinition, strike: Strike) =>
    featureStrike(definition, strike, () => 0).options.map(
      ({ source, attack, damage, critical }) => ({ source, attack, damage, critical }),
    );

  it("offers Hexblade's Curse's critical range as a trade, never lowering every attack's", () => {
    const hexblade = levelsOf("Warlock", "PHB", 1, "The Hexblade", "XGE");
    expect(featureStrike(hexblade, LONGBOW, () => 0).critical).toBeUndefined();
    expect(offered(hexblade, LONGBOW)).toEqual([
      { source: "Hexblade's Curse", attack: 0, damage: 0, critical: 19 },
    ]);
  });

  it("offers Charger on melee weapons and the unarmed strike, and Thrown Weapon Fighting on thrown weapons", () => {
    const charger = withFeat("Charger");
    const bonus = [{ source: "Charger", attack: 0, damage: 5, critical: null }];
    expect(offered(charger, RAPIER)).toEqual(bonus);
    expect(offered(charger, UNARMED)).toEqual(bonus);
    expect(offered(charger, LONGBOW)).toEqual([]);
    const thrower = withFeat("Thrown Weapon Fighting", "TCE");
    expect(offered(thrower, DAGGER)).toEqual([
      { source: "Thrown Weapon Fighting", attack: 0, damage: 2, critical: null },
    ]);
    expect(offered(thrower, RAPIER)).toEqual([]);
    expect(offered(thrower, UNARMED)).toEqual([]);
  });

  it("offers Returning Weapon on a thrown weapon alone", () => {
    const infuser = character({
      optionalFeatures: [{ featureType: "AI", ref: { name: "Returning Weapon", source: "TCE" } }],
    } as Partial<CharacterDefinition>);
    expect(offered(infuser, DAGGER).map(({ source }) => source)).toEqual(["Returning Weapon"]);
    expect(offered(infuser, RAPIER)).toEqual([]);
  });

  it("offers each size of Sharpen the Blade's bonus, from Kensei level 11", () => {
    const kensei = (level: number) => levelsOf("Monk", "PHB", level, "Way of the Kensei", "XGE");
    expect(offered(kensei(10), RAPIER)).toEqual([]);
    expect(offered(kensei(11), RAPIER).map(({ attack, damage }) => [attack, damage])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("offers no bonus added after the roll lands, as Focused Aim and Guided Strike add", () => {
    const monk = { ...levelsOf("Monk", "PHB", 5), houseRules: { optionalClassFeatures: true } };
    expect(offered(monk, UNARMED)).toEqual([]);
    const conqueror = levelsOf("Paladin", "PHB", 3, "Oath of Conquest", "XGE");
    expect(offered(conqueror, RAPIER)).toEqual([]);
  });

  it("offers Invincible Conqueror's critical range on melee weapons and the unarmed strike", () => {
    const conqueror = levelsOf("Paladin", "PHB", 20, "Oath of Conquest", "XGE");
    expect(featureStrike(conqueror, RAPIER, () => 0).critical).toBeUndefined();
    const range = [{ source: "Invincible Conqueror", attack: 0, damage: 0, critical: 19 }];
    expect(offered(conqueror, RAPIER)).toEqual(range);
    expect(offered(conqueror, UNARMED)).toEqual(range);
    expect(offered(conqueror, LONGBOW)).toEqual([]);
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

  it("offers Assassinate's advantage to an Assassin from level 3", () => {
    const assassin = (level: number) => levelsOf("Rogue", "PHB", level, "Assassin");
    expect(featureAttackEffects(assassin(2))).toEqual([]);
    expect(featureAttackEffects(assassin(3))).toEqual([
      expect.objectContaining({ source: "Assassinate", mode: "advantage", roll: "attack" }),
    ]);
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
    modifier: (ability) => ({ cha: 3, wis: 2 })[ability as string] ?? 0,
    proficiency: 3,
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

  it("offers TCE's Blessed Strikes beside Divine Strike only under optional class features", () => {
    const grave = levelsOf("Cleric", "PHB", 8, "Grave Domain", "XGE");
    expect(sources(grave, GREATSWORD)).toEqual([]);
    expect(sources({ ...grave, houseRules: { optionalClassFeatures: true } }, UNARMED)).toEqual([
      { source: "Blessed Strikes", dice: "1d8", bonus: 0 },
    ]);
  });

  it("offers the 2024 Divine Strike only where Blessed Strikes took it", () => {
    const blessed = {
      name: "Blessed Strikes",
      source: "XPHB",
      className: "Cleric",
      classSource: "XPHB",
      level: 7,
    };
    const took = (name: string) => ({
      ...levelsOf("Cleric", "XPHB", 7),
      featureChoices: [{ feature: blessed, options: [{ name, source: "XPHB" }] }],
    });
    expect(sources(took("Divine Strike"), GREATSWORD)).toEqual([
      { source: "Divine Strike", dice: "1d8", bonus: 0 },
    ]);
    expect(sources(took("Potent Spellcasting"), GREATSWORD)).toEqual([]);
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

  it("adds Divine Fury's half barbarian level to its die, only during a rage", () => {
    const zealot = levelsOf("Barbarian", "PHB", 7, "Path of the Zealot", "XGE");
    expect(sources(zealot, GREATSWORD, sheet({}, true))).toEqual([
      { source: "Divine Fury", dice: "1d6", bonus: 3 },
    ]);
    expect(sources(zealot, GREATSWORD)).toEqual([]);
  });

  it("adds the proficiency bonus for Genie's Wrath and Hexblade's Curse", () => {
    expect(sources(levelsOf("Warlock", "PHB", 5, "The Genie", "TCE"), UNARMED)).toEqual([
      { source: "Genie's Wrath", dice: null, bonus: 3 },
    ]);
    expect(sources(levelsOf("Warlock", "PHB", 1, "The Hexblade", "XGE"), RAPIER)).toEqual([
      { source: "Hexblade's Curse", dice: null, bonus: 3 },
    ]);
  });

  it("adds Hand of Harm's Martial Arts die and Wisdom to the unarmed strike alone", () => {
    const mercy = levelsOf("Monk", "PHB", 5, "Way of Mercy", "TCE");
    const cells = sheet({ martial_arts: "1d6" });
    expect(sources(mercy, UNARMED, cells)).toEqual([
      { source: "Hand of Harm", dice: "1d6", bonus: 2 },
    ]);
    expect(sources(mercy, RAPIER, cells)).toEqual([]);
  });

  it("offers Kensei's Shot on ranged weapons alone", () => {
    const kensei = levelsOf("Monk", "PHB", 3, "Way of the Kensei", "XGE");
    expect(sources(kensei, LONGBOW)).toEqual([{ source: "Kensei's Shot", dice: "1d4", bonus: 0 }]);
    expect(sources(kensei, RAPIER)).toEqual([]);
  });

  it("scales the superiority die with Battle Master levels, and the Martial Adept die not at all", () => {
    expect(sources(levelsOf("Fighter", "PHB", 10, "Battle Master"), RAPIER)).toEqual([
      { source: "Combat Superiority", dice: "1d10", bonus: 0 },
    ]);
    expect(sources(withFeat("Martial Adept"), RAPIER)).toEqual([
      { source: "Martial Adept", dice: "1d6", bonus: 0 },
    ]);
  });

  it("scales a domain's Divine Strike and gives it the domain's damage type", () => {
    const tempest = featureDamage(levelsOf("Cleric", "PHB", 14, "Tempest Domain"), RAPIER, sheet());
    expect(tempest).toEqual([expect.objectContaining({ dice: "2d8", type: "thunder" })]);
  });

  it("offers Favored Foe only where the table uses optional class features", () => {
    const ranger = levelsOf("Ranger", "PHB", 6);
    expect(sources(ranger, LONGBOW)).toEqual([]);
    const optional = { ...ranger, houseRules: { optionalClassFeatures: true } };
    expect(sources(optional as CharacterDefinition, LONGBOW)).toEqual([
      { source: "Favored Foe", dice: "1d6", bonus: 0 },
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

  it("adds a die for each pact slot level past the first for Eldritch Smite, never one versus", () => {
    const eldritch = {
      ...smite,
      source: "Eldritch Smite",
      offer: {
        condition: "with your pact weapon",
        oncePerTurn: true,
        slot: { max: 6, pact: true as const },
      },
    };
    expect(featureDamageDice(eldritch, 3, true)).toBe("4d8");
    expect(featureDamageDice(eldritch, 5)).toBe("6d8");
  });

  it("leaves dice that spend no slot as they are", () => {
    expect(featureDamageDice({ ...smite, offer: null }, 3)).toBe("2d8");
    expect(featureDamageDice({ ...smite, dice: null, bonus: 3 })).toBeNull();
  });
});

describe("offerSlots", () => {
  const slots = [
    { via: "slot" as const, level: 1, left: 2 },
    { via: "pact" as const, level: 3, left: 1 },
  ];

  it("keeps pact slots alone for an offer that says so, and every slot otherwise", () => {
    const offer = { condition: "x", oncePerTurn: false, slot: { max: 6, pact: true as const } };
    expect(offerSlots(slots, offer)).toEqual([slots[1]]);
    expect(offerSlots(slots, { ...offer, slot: { max: 5 } })).toEqual(slots);
  });
});
