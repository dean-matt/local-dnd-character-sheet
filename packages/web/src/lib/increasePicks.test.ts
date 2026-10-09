import type { IncreaseAlternative } from "@dnd/catalog";
import { ABILITIES } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { isComplete, raisesOf, readPicks } from "./increasePicks.ts";

const TASHA: IncreaseAlternative[] = [
  { fixed: {}, slots: [2, 1].map((amount) => ({ from: ABILITIES, amount })) },
  { fixed: {}, slots: [1, 1, 1].map((amount) => ({ from: ABILITIES, amount })) },
];
const plus = (ability: (typeof ABILITIES)[number], amount: number) => ({ ability, amount });

describe("readPicks", () => {
  it("reads three +1s as the second alternative, complete", () => {
    const picks = readPicks(TASHA, [plus("str", 1), plus("dex", 1), plus("con", 1)]);
    expect(picks).toEqual({ alternative: 1, slots: ["str", "dex", "con"] });
    expect(isComplete(TASHA, picks)).toBe(true);
  });

  it("leaves a slot nothing fills empty, and the alternative incomplete", () => {
    const picks = readPicks(TASHA, [plus("wis", 1)]);
    expect(picks).toEqual({ alternative: 0, slots: [undefined, "wis"] });
    expect(isComplete(TASHA, picks)).toBe(false);
  });

  it("explains nothing missing a fixed increase or holding one no slot takes", () => {
    const elf: IncreaseAlternative[] = [{ fixed: { dex: 2 }, slots: [] }];
    expect(readPicks(elf, [])).toBeUndefined();
    expect(readPicks(elf, [plus("dex", 2), plus("str", 1)])).toBeUndefined();
    expect(readPicks(TASHA, [plus("str", 2), plus("str", 1)])).toBeUndefined();
  });
});

describe("raisesOf", () => {
  it("stores the fixed increases and each filled slot", () => {
    const halfElf: IncreaseAlternative[] = [
      { fixed: { cha: 2 }, slots: [{ from: ["str", "dex"], amount: 1 }] },
    ];
    expect(raisesOf(halfElf, { alternative: 0, slots: ["dex"] })).toEqual([
      plus("cha", 2),
      plus("dex", 1),
    ]);
  });
});
