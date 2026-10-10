import { describe, expect, it } from "vitest";
import type { RollEffectEntry } from "./characterDerived.ts";
import { effectsOnRoll } from "./itemEffects.ts";

const effect = (rest: Omit<RollEffectEntry, "item">): RollEffectEntry => ({
  item: "Item",
  ...rest,
});

const SPELLS = effect({ mode: "advantage", roll: "save", condition: "against spells" });
const STRENGTH_SAVE = effect({ mode: "advantage", roll: "save", target: "str" });
const STEALTH = effect({ mode: "advantage", roll: "skill", target: "Stealth" });
const ANY_CHECK = effect({ mode: "advantage", roll: "check" });
const STRENGTH_CHECK = effect({ mode: "disadvantage", roll: "check", target: "str" });
const ATTACK = effect({ mode: "disadvantage", roll: "attack" });
const all = [SPELLS, STRENGTH_SAVE, STEALTH, ANY_CHECK, STRENGTH_CHECK, ATTACK];

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

  it("marks an attack with the attack effects alone", () => {
    expect(effectsOnRoll(all, { roll: "attack" })).toEqual([ATTACK]);
  });
});
