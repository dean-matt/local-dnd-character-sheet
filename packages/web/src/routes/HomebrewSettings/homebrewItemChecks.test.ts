import { describe, expect, it } from "vitest";
import { homebrewItemFormSchema } from "./homebrewItemChecks.ts";

const item = { name: "Blade", edition: "one" as const };
const problems = (fields: Record<string, unknown>) => {
  const result = homebrewItemFormSchema.safeParse({ ...item, ...fields });
  return result.success ? [] : result.error.issues.map(({ path, message }) => [path[0], message]);
};

describe("homebrewItemFormSchema", () => {
  it("takes damage the roller can roll or a flat number, and a critical range of 2 to 19", () => {
    expect(problems({ dmg1: "1d8", dmg2: "2d6+1", critThreshold: 19 })).toEqual([]);
    expect(problems({ dmg1: "1" })).toEqual([]);
    expect(problems({ critThreshold: 2 })).toEqual([]);
  });

  it("names a damage field the roller cannot roll", () => {
    expect(problems({ dmg1: "1d", dmg2: "d8 fire" })).toEqual([
      ["dmg1", "Not dice notation, such as 1d8 or 2d6"],
      ["dmg2", "Not dice notation, such as 1d8 or 2d6"],
    ]);
  });

  it("names a critical range the sheet would ignore", () => {
    for (const critThreshold of [1, 20, 25, 18.5]) {
      expect(problems({ critThreshold })).toEqual([["critThreshold", "A d20 roll from 2 to 19"]]);
    }
  });
});
