import { describe, expect, it } from "vitest";
import type { RollEffectEntry } from "./characterDerived.ts";
import {
  conditionRollEffects,
  effectsOnRoll,
  exhaustionRollEffects,
  netRollEffect,
} from "./rollEffects.ts";

const effect = (rest: Omit<RollEffectEntry, "source">): RollEffectEntry => ({
  source: "Item",
  ...rest,
});

const SPELLS = effect({ mode: "advantage", roll: "save", condition: "against spells" });
const STRENGTH_SAVE = effect({ mode: "advantage", roll: "save", target: "str" });
const STEALTH = effect({ mode: "advantage", roll: "skill", target: "Stealth" });
const ANY_CHECK = effect({ mode: "advantage", roll: "check" });
const STRENGTH_CHECK = effect({ mode: "disadvantage", roll: "check", target: "str" });
const ATTACK = effect({ mode: "disadvantage", roll: "attack" });
const STRENGTH_ATTACK = effect({ mode: "disadvantage", roll: "attack", target: "str" });
const all = [SPELLS, STRENGTH_SAVE, STEALTH, ANY_CHECK, STRENGTH_CHECK, ATTACK, STRENGTH_ATTACK];

describe("effectsOnRoll", () => {
  it("marks a save with the effects for every save and for its own ability", () => {
    expect(effectsOnRoll(all, { roll: "save", ability: "str" })).toEqual([SPELLS, STRENGTH_SAVE]);
    expect(effectsOnRoll(all, { roll: "save", ability: "dex" })).toEqual([SPELLS]);
  });

  it("marks a skill with its own effects and the checks of its ability", () => {
    expect(effectsOnRoll(all, { roll: "skill", skill: "Stealth", ability: "dex" })).toEqual([
      STEALTH,
      ANY_CHECK,
    ]);
    expect(effectsOnRoll(all, { roll: "skill", skill: "Athletics", ability: "str" })).toEqual([
      ANY_CHECK,
      STRENGTH_CHECK,
    ]);
  });

  it("marks a flat skill with its own effects and the checks that name no ability", () => {
    expect(effectsOnRoll(all, { roll: "skill", skill: "Stealth", ability: null })).toEqual([
      STEALTH,
      ANY_CHECK,
    ]);
  });

  it("marks an attack with the effects for every attack and for its own ability", () => {
    expect(effectsOnRoll(all, { roll: "attack", ability: "str" })).toEqual([
      ATTACK,
      STRENGTH_ATTACK,
    ]);
    expect(effectsOnRoll(all, { roll: "attack", ability: "int" })).toEqual([ATTACK]);
  });
});

describe("netRollEffect", () => {
  it("names nothing for a roll no effect marks", () => {
    expect(netRollEffect([])).toBeUndefined();
  });

  it("keeps the one mode that applies, however many effects grant it", () => {
    expect(netRollEffect([STEALTH, ANY_CHECK])).toEqual({ mode: "advantage", conditional: false });
    expect(netRollEffect([ATTACK])).toEqual({ mode: "disadvantage", conditional: false });
  });

  it("cancels advantage against disadvantage, whatever the count of each", () => {
    expect(netRollEffect([STEALTH, ANY_CHECK, STRENGTH_CHECK])).toEqual({
      mode: "cancel",
      conditional: false,
    });
  });

  it("flags a roll any conditional effect marks", () => {
    expect(netRollEffect([SPELLS])).toEqual({ mode: "advantage", conditional: true });
    expect(netRollEffect([SPELLS, STRENGTH_SAVE, ATTACK])).toEqual({
      mode: "cancel",
      conditional: true,
    });
  });
});

describe("conditionRollEffects", () => {
  const held = (...names: string[]) => ({
    conditions: names.map((name) => ({ name })),
    exhaustion: 0,
  });

  it("names each condition that bears on an attack roll, and none that does not", () => {
    expect(conditionRollEffects(held("Poisoned", "Invisible", "Charmed"), "one", "attack")).toEqual(
      [
        { source: "Invisible", mode: "advantage", roll: "attack" },
        { source: "Poisoned", mode: "disadvantage", roll: "attack" },
      ],
    );
  });

  it("keeps Frightened conditional on the source being in sight", () => {
    expect(conditionRollEffects(held("Frightened"), "one", "attack")).toEqual([
      {
        source: "Frightened",
        mode: "disadvantage",
        roll: "attack",
        condition: "while the source of fear is in line of sight",
      },
    ]);
  });

  it("puts Poisoned and Frightened on ability checks, Frightened conditionally", () => {
    expect(
      conditionRollEffects(held("Poisoned", "Frightened", "Prone"), "classic", "check"),
    ).toEqual([
      { source: "Poisoned", mode: "disadvantage", roll: "check" },
      {
        source: "Frightened",
        mode: "disadvantage",
        roll: "check",
        condition: "while the source of fear is in line of sight",
      },
    ]);
  });

  it("puts Restrained's disadvantage on Dexterity saves only", () => {
    expect(conditionRollEffects(held("Restrained"), "one", "save")).toEqual([
      { source: "Restrained", mode: "disadvantage", roll: "save", target: "dex" },
    ]);
  });

  it("gives an Invisible 2024 character advantage on initiative, a classic one none", () => {
    expect(conditionRollEffects(held("Invisible", "Poisoned"), "one", "initiative")).toEqual([
      { source: "Invisible", mode: "advantage", roll: "check" },
      { source: "Poisoned", mode: "disadvantage", roll: "check" },
    ]);
    expect(conditionRollEffects(held("Invisible"), "classic", "initiative")).toEqual([]);
    expect(conditionRollEffects(held("Invisible"), "one", "check")).toEqual([]);
  });

  it("counts exhaustion from level 3, in the classic ruleset only", () => {
    const tired = { conditions: [], exhaustion: 3 };
    expect(conditionRollEffects(tired, "classic", "attack")).toHaveLength(1);
    expect(conditionRollEffects(tired, "one", "attack")).toEqual([]);
    expect(conditionRollEffects({ ...tired, exhaustion: 2 }, "classic", "attack")).toEqual([]);
  });
});

describe("conditionRollEffects under the 2024 exhaustion rule", () => {
  const tired = { conditions: [], exhaustion: 3 };

  it("drops a classic character's disadvantage, keeping its other conditions", () => {
    expect(conditionRollEffects(tired, "classic", "attack", "one")).toEqual([]);
    expect(
      conditionRollEffects(
        { ...tired, conditions: [{ name: "Poisoned" }] },
        "classic",
        "check",
        "one",
      ),
    ).toEqual([{ source: "Poisoned", mode: "disadvantage", roll: "check" }]);
  });
});

describe("exhaustionRollEffects", () => {
  const dis = (level: number, roll: "check" | "save" | "attack") => [
    { source: `Exhaustion ${level}`, mode: "disadvantage", roll },
  ];

  it("gives disadvantage on checks from level 1 and on saves from level 3", () => {
    expect(exhaustionRollEffects(0, "classic", "check")).toEqual([]);
    expect(exhaustionRollEffects(1, "classic", "check")).toEqual(dis(1, "check"));
    expect(exhaustionRollEffects(2, "classic", "save")).toEqual([]);
    expect(exhaustionRollEffects(3, "classic", "save")).toEqual(dis(3, "save"));
  });

  it("names the level on an attack roll too", () => {
    expect(exhaustionRollEffects(4, "classic", "attack")).toEqual(dis(4, "attack"));
  });

  it("leaves a 2024 character alone", () => {
    expect(exhaustionRollEffects(5, "one", "check")).toEqual([]);
  });
});
