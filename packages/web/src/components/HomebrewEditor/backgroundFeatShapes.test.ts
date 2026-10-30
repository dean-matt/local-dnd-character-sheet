import { describe, expect, it } from "vitest";
import { readFeats, writeFeats } from "./backgroundFeatShapes.ts";

describe("readFeats", () => {
  it("reads a fixed feat and a choice of feats as upstream writes them", () => {
    expect(readFeats(undefined)).toEqual({ mode: "none" });
    expect(readFeats([{ "skilled|xphb": true }])).toEqual({
      mode: "fixed",
      names: ["skilled|xphb"],
    });
    expect(readFeats([{ "alert|xphb": true }, { "skilled|xphb": true }])).toEqual({
      mode: "list",
      names: ["alert|xphb", "skilled|xphb"],
    });
  });

  it("leaves a pick from a category to the JSON", () => {
    expect(readFeats([{ anyFromCategory: { category: ["DG"] } }])).toBeUndefined();
    expect(readFeats([{ "alert|xphb": true }, { anyFromCategory: { category: ["DG"] } }])).toBe(
      undefined,
    );
  });
});

describe("writeFeats", () => {
  it("writes a fixed feat as one alternative and a choice as one per feat", () => {
    expect(writeFeats({ mode: "fixed", names: ["alert|xphb"] })).toEqual([{ "alert|xphb": true }]);
    expect(writeFeats({ mode: "list", names: ["a|x", "b|x"] })).toEqual([
      { "a|x": true },
      { "b|x": true },
    ]);
    expect(writeFeats({ mode: "list", names: [] })).toBeUndefined();
    expect(writeFeats({ mode: "none" })).toBeUndefined();
  });
});
