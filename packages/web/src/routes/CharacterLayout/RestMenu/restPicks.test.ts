import { describe, expect, it } from "vitest";
import { largestFirst, pickedDice } from "./restPicks.ts";

const pick = {
  allowed: 3,
  spent: [
    { die: 6 as const, count: 2 },
    { die: 10 as const, count: 2 },
  ],
};

describe("largestFirst", () => {
  it("fills the largest die first, up to what returns", () => {
    expect(largestFirst(pick)).toEqual(["1", "2"]);
  });
});

describe("pickedDice", () => {
  it("lists one die per count", () => {
    expect(pickedDice(pick, ["1", "2"])).toEqual([6, 10, 10]);
    expect(pickedDice(pick, ["0", "0"])).toEqual([]);
  });

  it.each([[["2", "2"]], [["3", "0"]], [["", "1"]], [["1.5", "0"]], [["-1", "0"]]])(
    "refuses %o",
    (typed) => {
      expect(pickedDice(pick, typed)).toBeUndefined();
    },
  );
});
