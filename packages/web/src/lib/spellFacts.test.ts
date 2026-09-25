import { describe, expect, it } from "vitest";
import {
  castingTime,
  schoolName,
  spellComponents,
  spellDuration,
  spellRange,
} from "./spellFacts.ts";

describe("castingTime", () => {
  it("names the unit, pluralized past one, and joins alternatives", () => {
    expect(castingTime([{ number: 1, unit: "bonus" }])).toBe("1 bonus action");
    expect(castingTime([{ number: 10, unit: "minute" }])).toBe("10 minutes");
    expect(
      castingTime([
        { number: 1, unit: "action" },
        { number: 8, unit: "hour" },
      ]),
    ).toBe("1 action or 8 hours");
  });

  it("leaves an unstated time unstated", () => {
    expect(castingTime(undefined)).toBeUndefined();
  });
});

describe("spellRange", () => {
  it("prints a distance, a named range, and an area centred on the caster", () => {
    expect(spellRange({ type: "point", distance: { type: "feet", amount: 90 } })).toBe("90 feet");
    expect(spellRange({ type: "point", distance: { type: "miles", amount: 1 } })).toBe("1 mile");
    expect(spellRange({ type: "point", distance: { type: "touch" } })).toBe("Touch");
    expect(spellRange({ type: "cone", distance: { type: "feet", amount: 15 } })).toBe(
      "Self (15-foot cone)",
    );
    expect(spellRange({ type: "special" })).toBe("Special");
  });
});

describe("spellComponents", () => {
  it("lists each component, with the material's text where it has one", () => {
    expect(spellComponents({ v: true, s: true, m: "a pinch of salt" })).toBe(
      "V, S, M (a pinch of salt)",
    );
    expect(spellComponents({ s: true, m: { text: "a diamond worth 300+ GP" } })).toBe(
      "S, M (a diamond worth 300+ GP)",
    );
    expect(spellComponents({ v: true, m: true, r: true })).toBe("V, M, R");
  });

  it("prints nothing for a spell that needs none", () => {
    expect(spellComponents({})).toBeUndefined();
  });
});

describe("spellDuration", () => {
  it("prints how long, leaving concentration to its own mark", () => {
    expect(spellDuration([{ type: "instant" }])).toBe("Instantaneous");
    expect(spellDuration([{ type: "timed", duration: { type: "hour", amount: 8 } }])).toBe(
      "8 hours",
    );
    expect(
      spellDuration([
        { type: "timed", duration: { type: "minute", amount: 1 }, concentration: true },
      ]),
    ).toBe("Up to 1 minute");
    expect(spellDuration([{ type: "permanent", ends: ["dispel", "trigger"] }])).toBe(
      "Until dispelled or triggered",
    );
  });
});

describe("schoolName", () => {
  it("spells out a school code, and prints one it does not know as itself", () => {
    expect(schoolName("V")).toBe("Evocation");
    expect(schoolName("P")).toBe("P");
  });
});
