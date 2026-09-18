import { describe, expect, it } from "vitest";
import { type Entries, entriesSchema } from "./index.ts";

describe("entriesSchema", () => {
  it("accepts a plain string entry", () => {
    expect(entriesSchema.parse(["You hurl a bubble of acid."])).toEqual([
      "You hurl a bubble of acid.",
    ]);
  });

  it("accepts a node with entries nested inside", () => {
    const parsed = entriesSchema.parse([
      { type: "list", items: ["a", "b"], entries: ["nested prose"] },
    ]);
    expect(parsed).toEqual([{ type: "list", items: ["a", "b"], entries: ["nested prose"] }]);
  });

  it("recurses arbitrarily deep", () => {
    const parsed = entriesSchema.parse([
      { type: "entries", entries: [{ type: "entries", entries: ["deep prose"] }] },
    ]);
    expect(parsed).toEqual([
      { type: "entries", entries: [{ type: "entries", entries: ["deep prose"] }] },
    ]);
  });

  it("keeps a node's own fields, unvalidated", () => {
    const parsed: Entries = entriesSchema.parse([
      { type: "table", caption: "Loot", colLabels: ["Die"] },
    ]);
    expect(parsed).toEqual([{ type: "table", caption: "Loot", colLabels: ["Die"] }]);
  });

  it("rejects a number in place of a string or a node", () => {
    expect(entriesSchema.safeParse([1]).success).toBe(false);
  });
});
