import { describe, expect, it } from "vitest";
import { attunementSlots } from "./index.ts";

describe("attunementSlots", () => {
  it.each([
    [0, 3],
    [9, 3],
    [10, 4],
    [13, 4],
    [14, 5],
    [17, 5],
    [18, 6],
    [20, 6],
  ])("gives an Artificer %i attunement to %i items", (level, slots) => {
    expect(attunementSlots(level)).toBe(slots);
  });
});
