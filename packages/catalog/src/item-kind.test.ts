import { describe, expect, it } from "vitest";
import { itemKinds } from "./index.ts";

describe("itemKinds", () => {
  it.each([
    ["M", "melee"],
    ["R|XPHB", "ranged"],
    ["AF|DMG", "ammunition"],
    ["LA", "light"],
    ["MA|XPHB", "medium"],
    ["HA", "heavy"],
    ["S", "shield"],
    ["P", "potion"],
    ["SC", "scroll"],
    ["RG", "ring"],
    ["WD", "wand"],
    ["RD", "rod"],
    ["SCF|XPHB", "focus"],
    ["G|XPHB", "gear"],
    ["INS", "tool"],
    ["$G", "treasure"],
  ])("reads type %s as %s", (type, kind) => {
    expect(itemKinds({ type })).toEqual([kind]);
  });

  it("adds a flag's kind beside the type's", () => {
    expect(itemKinds({ type: "M", staff: true })).toEqual(["melee", "staff"]);
    expect(itemKinds({ type: "INS", wondrous: true })).toEqual(["tool", "wondrous"]);
  });

  it("reads a flag alone where no type is stated", () => {
    expect(itemKinds({ wondrous: true })).toEqual(["wondrous"]);
    expect(itemKinds({ staff: 1 })).toEqual(["staff"]);
  });

  it("calls an item nothing places other", () => {
    expect(itemKinds({ type: "SHP" })).toEqual(["other"]);
    expect(itemKinds({ type: "OTH", wondrous: true })).toEqual(["wondrous"]);
    expect(itemKinds({})).toEqual(["other"]);
  });
});
