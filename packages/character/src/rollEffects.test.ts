import { describe, expect, it } from "vitest";
import type { RollEffectEntry } from "./characterDerived.ts";
import { effectsOnRoll, netRollEffect } from "./rollEffects.ts";

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
