import { describe, expect, it } from "vitest";
import { gainSource, hitPointMethodOf, parseGain, withGainDepartures } from "./hitPointGains.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const levels = (...gains: (number | undefined)[]) =>
  gains.map((rolled) => (rolled === undefined ? { class: FIGHTER } : { class: FIGHTER, rolled }));

describe("withGainDepartures", () => {
  const homebrew = { field: "levels", note: "a homebrew class" };

  it("notes each gain after the first the die cannot roll, keeping other departures", () => {
    expect(withGainDepartures([homebrew], levels(undefined, 11, 10, 0), 10)).toEqual([
      homebrew,
      {
        field: "levels.1.rolled",
        note: "Level 2 gains 11 hit points, outside the d10's 1 to 10.",
      },
      { field: "levels.3.rolled", note: "Level 4 gains 0 hit points, outside the d10's 1 to 10." },
    ]);
  });

  it("drops a note whose level is gone or back in range", () => {
    const stale = withGainDepartures([], levels(undefined, 11, 12), 10);
    expect(withGainDepartures(stale, levels(undefined, 4), 10)).toEqual([]);
  });
});

describe("hitPointMethodOf", () => {
  it("reads Custom off a gain outside the die or beside a blank, a roll off a full set, and the average off none", () => {
    expect(hitPointMethodOf(levels(undefined, 3, 15), 10)).toBe("custom");
    expect(hitPointMethodOf(levels(undefined, 5, undefined), 10)).toBe("custom");
    expect(hitPointMethodOf(levels(undefined, 3, 4), 10)).toBe("roll");
    expect(hitPointMethodOf(levels(undefined, undefined), 10)).toBe("average");
  });
});

describe("gainSource", () => {
  it("names the first level's highest face, an unset gain the average, and one past the die typed", () => {
    expect([gainSource(0, 4, 10), gainSource(1, undefined, 10)]).toEqual([
      "highest face",
      "average",
    ]);
    expect([gainSource(1, 10, 10), gainSource(1, 11, 10)]).toEqual(["rolled", "typed"]);
  });
});

describe("parseGain", () => {
  it("takes a whole number of any sign, leaves an empty field unset, and refuses the rest", () => {
    expect(parseGain(" 15 ")).toBe(15);
    expect(parseGain("-2")).toBe(-2);
    expect(parseGain("")).toBeUndefined();
    expect(parseGain("1.5")).toBeNull();
    expect(parseGain("99999999999999999999")).toBeNull();
  });
});
