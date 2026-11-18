import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureRolls, rollBonusTerms } from "./featureRolls.ts";
import type { Ability } from "./refs.ts";
import { effectsOnRoll } from "./rollEffects.ts";
import { definition } from "./test/vex.ts";

const MODIFIERS: Record<Ability, number> = { str: 0, dex: 2, con: 1, int: 0, wis: 3, cha: -1 };

const levelsOf = (
  className: string,
  source: string,
  count: number,
  extra: Partial<CharacterDefinition> = {},
): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, () => ({ class: { name: className, source } })),
  ...extra,
});

const rolls = (character: CharacterDefinition, raging = false) =>
  featureRolls(character, (ability) => MODIFIERS[ability], raging);

describe("featureRolls", () => {
  it("adds Aura of Protection to every save from Paladin level 6, at least +1", () => {
    const { bonuses } = rolls(levelsOf("Paladin", "PHB", 6));
    expect(rollBonusTerms(bonuses, { roll: "save", ability: "wis" })).toEqual([
      {
        label: "Aura of Protection",
        value: 1,
        reference: { name: "Aura of Protection", source: "PHB" },
      },
    ]);
    expect(rolls(levelsOf("Paladin", "PHB", 5)).bonuses).toEqual([]);
  });

  it("gives the 2024 Danger Sense advantage on Dexterity saves, and the 2014 one only as a condition", () => {
    const one = rolls(levelsOf("Barbarian", "XPHB", 2)).effects;
    expect(effectsOnRoll(one, { roll: "save", ability: "dex" })).toEqual([
      { source: "Danger Sense", mode: "advantage", roll: "save", target: "dex" },
    ]);
    expect(effectsOnRoll(one, { roll: "save", ability: "str" })).toEqual([]);
    const classic = rolls(levelsOf("Barbarian", "PHB", 2)).effects;
    expect(effectsOnRoll(classic, { roll: "save", ability: "dex" })).toEqual([
      {
        source: "Danger Sense",
        mode: "advantage",
        roll: "save",
        target: "dex",
        condition: "against an effect you can see",
      },
    ]);
  });

  it("gives Rage's Strength advantage only while raging", () => {
    const character = levelsOf("Barbarian", "PHB", 1);
    expect(rolls(character).effects).toEqual([]);
    expect(
      effectsOnRoll(rolls(character, true).effects, { roll: "check", ability: "str" }),
    ).toEqual([{ source: "Rage", mode: "advantage", roll: "check", target: "str" }]);
  });

  it("offers Hide in Plain Sight's +10 on Stealth as an option, never a term", () => {
    const { bonuses, options } = rolls(levelsOf("Ranger", "PHB", 10));
    expect(rollBonusTerms(bonuses, { roll: "skill", skill: "Stealth" })).toEqual([]);
    expect(effectsOnRoll(options, { roll: "skill", skill: "Stealth", ability: "dex" })).toEqual([
      {
        source: "Hide in Plain Sight",
        value: 10,
        roll: "skill",
        target: "stealth",
        condition: "while camouflaged and still",
      },
    ]);
  });

  it("offers the 2024 Indomitable's reroll bonus at the Fighter level", () => {
    const { options } = rolls(levelsOf("Fighter", "XPHB", 13));
    expect(options).toEqual([
      {
        source: "Indomitable",
        value: 13,
        roll: "save",
        condition: "on the reroll of a failed save",
      },
    ]);
  });

  it("adds Thaumaturge's Wisdom to Arcana and Religion only where Divine Order took it", () => {
    const order = {
      name: "Divine Order",
      source: "XPHB",
      className: "Cleric",
      classSource: "XPHB",
      level: 1,
    };
    const took = (name: string) => ({
      featureChoices: [{ feature: order, options: [{ name, source: "XPHB" }] }],
    });
    const { bonuses } = rolls(levelsOf("Cleric", "XPHB", 1, took("Thaumaturge")));
    expect(rollBonusTerms(bonuses, { roll: "skill", skill: "Religion" })).toMatchObject([
      { label: "Thaumaturge", value: 3 },
    ]);
    expect(rollBonusTerms(bonuses, { roll: "skill", skill: "History" })).toEqual([]);
    expect(rolls(levelsOf("Cleric", "XPHB", 1, took("Protector"))).bonuses).toEqual([]);
  });

  it("gives Steel Will's frightened advantage only where Defensive Tactics took it", () => {
    const tactics = {
      name: "Defensive Tactics",
      source: "PHB",
      className: "Ranger",
      classSource: "PHB",
      subclass: { shortName: "Hunter", source: "PHB" },
      level: 7,
    };
    const hunter = (option: string) => {
      const ranger = levelsOf("Ranger", "PHB", 7, {
        featureChoices: [{ feature: tactics, options: [{ name: option, source: "PHB" }] }],
      });
      return {
        ...ranger,
        levels: ranger.levels.map((level) => ({
          ...level,
          subclass: { name: "Hunter", source: "PHB" },
        })),
      };
    };
    const steelWill = (character: CharacterDefinition) =>
      effectsOnRoll(rolls(character).effects, { roll: "save", ability: "wis" }).filter(
        ({ source }) => source === "Steel Will",
      );
    expect(steelWill(hunter("Steel Will"))).toHaveLength(1);
    expect(steelWill(hunter("Escape the Horde"))).toEqual([]);
  });

  it("marks initiative and death saves for a 2024 Champion", () => {
    const champion = levelsOf("Fighter", "XPHB", 18);
    const subclassed = {
      ...champion,
      levels: champion.levels.map((level) => ({
        ...level,
        subclass: { name: "Champion", source: "XPHB" },
      })),
    };
    const { effects } = rolls(subclassed);
    expect(effectsOnRoll(effects, { roll: "initiative" }).map(({ source }) => source)).toEqual([
      "Remarkable Athlete",
    ]);
    expect(effectsOnRoll(effects, { roll: "deathSave" }).map(({ source }) => source)).toEqual([
      "Survivor",
    ]);
  });

  it.each([
    ["Elf", "Fey Ancestry", "wis"],
    ["Half-Elf", "Fey Ancestry", "wis"],
    ["Gnome", "Gnome Cunning", "int"],
    ["Halfling", "Brave", "str"],
  ] as const)("gives a %s %s's conditional save advantage", (race, trait, ability) => {
    const character = { ...levelsOf("Fighter", "PHB", 1), race: { name: race, source: "PHB" } };
    const marked = effectsOnRoll(rolls(character).effects, { roll: "save", ability });
    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatchObject({ source: trait, mode: "advantage" });
    expect(marked[0]?.condition).toBeDefined();
  });

  it("gives Gnome Cunning on mental saves alone", () => {
    const character = { ...levelsOf("Fighter", "PHB", 1), race: { name: "Gnome", source: "PHB" } };
    expect(effectsOnRoll(rolls(character).effects, { roll: "save", ability: "dex" })).toEqual([]);
  });
});
