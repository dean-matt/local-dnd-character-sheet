import { describe, expect, it } from "vitest";
import { defaultCharacterState, longRestHitDicePick, restedState, sheetState } from "./index.ts";

const total = (computed: number, manual: number | null = null) => ({ computed, manual, terms: [] });

const sheet = {
  hitDice: [
    { die: 10 as const, total: total(3) },
    { die: 6 as const, total: total(2, 3) },
  ],
  spellSlots: [{ level: 1, total: total(4) }],
  pactSlots: { level: 2, total: total(2) },
};

const state = () => ({
  ...defaultCharacterState(),
  hitPoints: { current: 5, temporary: 2 },
  hitDice: [
    { die: 10 as const, total: 5, remaining: 4 },
    { die: 8 as const, total: 2, remaining: 0 },
  ],
  spellSlots: [
    { level: 1, total: 4, expended: 3 },
    { level: 3, total: 2, expended: 2 },
  ],
  pactSlots: { level: 1, total: 2, expended: 1 },
});

const tired = () => ({
  ...state(),
  hitDice: [
    { die: 10 as const, total: 3, remaining: 0 },
    { die: 6 as const, total: 3, remaining: 0 },
  ],
});

const classic = { edition: "classic" as const, houseRules: {} };

describe("sheetState", () => {
  it("reads each shown pool's total from the derived block and caps what remains at it", () => {
    expect(sheetState(sheet, state()).hitDice).toEqual([
      { die: 10, total: 3, remaining: 3 },
      { die: 6, total: 3, remaining: 3 },
    ]);
  });
});

describe("restedState", () => {
  it("measures a long rest against the totals the sheet shows", () => {
    const after = restedState(classic, sheet, state(), "long");
    expect(after.hitDice).toEqual([
      { die: 10, total: 3, remaining: 3 },
      { die: 6, total: 3, remaining: 3 },
    ]);
    expect(after.spellSlots).toEqual([{ level: 1, total: 4, expended: 0 }]);
    expect(after.pactSlots).toEqual({ level: 2, total: 2, expended: 0 });
    expect(after.hitPoints).toEqual({ current: null, temporary: 0 });
  });

  it("leaves slots the sheet shows spent where a short rest does not reach", () => {
    const after = restedState(classic, sheet, state(), "short");
    expect(after.spellSlots).toEqual([{ level: 1, total: 4, expended: 3 }]);
    expect(after.hitPoints).toEqual({ current: 5, temporary: 2 });
  });

  it("returns the picked sizes on a classic long rest", () => {
    expect(longRestHitDicePick(classic, sheet, tired())).toEqual({
      allowed: 3,
      spent: [
        { die: 10, count: 3 },
        { die: 6, count: 3 },
      ],
    });
    expect(restedState(classic, sheet, tired(), "long", [10, 6]).hitDice).toEqual([
      { die: 10, total: 3, remaining: 1 },
      { die: 6, total: 3, remaining: 1 },
    ]);
  });

  it("asks nothing under the house rule or in the 2024 rules", () => {
    const house = { ...classic, houseRules: { everyHitDieOnLongRest: true } };
    expect(longRestHitDicePick(house, sheet, tired())).toBeNull();
    expect(longRestHitDicePick({ ...classic, edition: "one" }, sheet, tired())).toBeNull();
    expect(
      restedState(house, sheet, tired(), "long").hitDice.map((pool) => pool.remaining),
    ).toEqual([3, 3]);
  });
});
