import { describe, expect, it } from "vitest";
import {
  armorClassIsProse,
  firstArmorClass,
  ratingOf,
  speedFeet,
  withArmorClass,
  withRating,
  withSpeed,
} from "./monsterShapes.ts";

describe("monster shapes", () => {
  it("reads and writes a plain and a conditional speed", () => {
    expect(speedFeet({ walk: 30, fly: { number: 60, condition: "(hover)" } }, "fly")).toBe(60);
    expect(withSpeed({ fly: { number: 60, condition: "(hover)" } }, "fly", 90)).toEqual({
      fly: { number: 90, condition: "(hover)" },
    });
    expect(withSpeed({ walk: 30, climb: 20 }, "climb", undefined)).toEqual({ walk: 30 });
    expect(withSpeed({ walk: 30 }, "walk", undefined)).toEqual({});
    expect(withSpeed(undefined, "swim", 40)).toEqual({ swim: 40 });
  });

  it("edits the first armor class and keeps the rest", () => {
    expect(firstArmorClass([{ ac: 15, from: ["natural armor"] }, 12])).toBe(15);
    expect(withArmorClass([{ ac: 15, from: ["natural armor"] }, 12], 16)).toEqual([
      { ac: 16, from: ["natural armor"] },
      12,
    ]);
    expect(withArmorClass([12], undefined)).toBeUndefined();
    expect(withArmorClass(undefined, 11)).toEqual([11]);
    expect(armorClassIsProse([{ special: "equal to 10 + level" }])).toBe(true);
  });

  it("reads and writes a rating in either form", () => {
    expect(ratingOf({ cr: "1/2", lair: "2" })).toBe("1/2");
    expect(withRating({ cr: "1", lair: "2" }, "3")).toEqual({ cr: "3", lair: "2" });
    expect(withRating("1", "1/4")).toBe("1/4");
  });
});
