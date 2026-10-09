import { describe, expect, it } from "vitest";
import { featTermsSchema } from "./index.ts";

describe("featTermsSchema", () => {
  it("reads a 2024 feat's category, repeat and level-and-score alternatives", () => {
    expect(
      featTermsSchema.parse({
        category: "G",
        prerequisite: [
          { level: 4, ability: [{ str: 13 }] },
          { level: 4, ability: [{ dex: 13 }] },
        ],
      }),
    ).toEqual({
      category: "G",
      repeatable: false,
      prerequisites: [
        { level: 4, scores: [{ str: 13 }] },
        { level: 4, scores: [{ dex: 13 }] },
      ],
    });
    expect(featTermsSchema.parse({ category: "G", repeatable: true }).repeatable).toBe(true);
  });

  it("keeps a score list's alternatives and a level's class", () => {
    expect(
      featTermsSchema.parse({
        prerequisite: [
          { ability: [{ int: 13 }, { wis: 13 }] },
          { level: { level: 1, class: { name: "Fighter", visible: true } } },
        ],
      }).prerequisites,
    ).toEqual([
      { scores: [{ int: 13 }, { wis: 13 }] },
      { level: 1, className: "Fighter", scores: [] },
    ]);
  });

  it("reads a kind it does not judge as needing nothing, and no prerequisite as none", () => {
    expect(
      featTermsSchema.parse({ prerequisite: [{ race: [{ name: "dwarf" }] }] }).prerequisites,
    ).toEqual([{ scores: [] }]);
    expect(featTermsSchema.parse({}).prerequisites).toEqual([]);
  });
});
