import { describe, expect, it } from "vitest";
import { homebrewMonsterInputSchema } from "./index.ts";

const imp = {
  name: "Ember Imp",
  edition: "one",
  size: ["T"],
  type: { type: "fiend", tags: ["devil"] },
  ac: [{ ac: 13, from: ["natural armor"] }],
  hp: { average: 10, formula: "3d4 + 3" },
  speed: { walk: 20, fly: { number: 40, condition: "(hover)" } },
  str: 6,
  dex: 17,
  con: 13,
  int: 11,
  wis: 12,
  cha: 14,
  cr: { cr: "1/2", lair: "1" },
};

describe("homebrewMonsterInputSchema", () => {
  it("accepts upstream's richer shapes and keeps fields it does not name", () => {
    const parsed = homebrewMonsterInputSchema.parse({ ...imp, alignment: ["C", "E"] });
    expect(parsed).toMatchObject({ alignment: ["C", "E"], cr: { cr: "1/2" } });
  });

  it.each([
    ["an empty speed", { speed: {} }],
    ["no size", { size: [] }],
    ["a score of 0", { str: 0 }],
    ["a rating of 31", { cr: "31" }],
    ["an unknown edition", { edition: "2014" }],
  ])("refuses %s", (_label, change) => {
    expect(homebrewMonsterInputSchema.safeParse({ ...imp, ...change }).success).toBe(false);
  });
});
