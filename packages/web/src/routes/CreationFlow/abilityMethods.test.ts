import { describe, expect, it } from "vitest";
import { methodDeparture, methodOf, pointsSpent } from "./abilityMethods.ts";

describe("pointsSpent", () => {
  it("prices each score off the point-buy table, a score past its ends at the nearer end", () => {
    expect(pointsSpent({ str: 15, dex: 14, con: 8 })).toBe(16);
    expect(pointsSpent({ str: 16, dex: 3 })).toBe(9);
  });
});

describe("methodDeparture", () => {
  it("leaves a roll unnoted, whatever it came to", () => {
    expect(methodDeparture("roll", { str: 18, dex: 3 })).toBeUndefined();
  });
});

describe("methodOf", () => {
  it("reads the method a departure names before the scores", () => {
    const departures = [{ field: "abilityScores", note: "Point buy spends 30 of 27 points." }];
    expect(methodOf({ str: 15, dex: 15, con: 15 }, departures)).toBe("pointBuy");
  });

  it("reads a partly assigned standard array as one, and anything past point buy as a roll", () => {
    expect(methodOf({}, [])).toBe("standard");
    expect(methodOf({ str: 15, dex: 13 }, [])).toBe("standard");
    expect(methodOf({ str: 9, dex: 9 }, [])).toBe("pointBuy");
    expect(methodOf({ str: 17, dex: 9 }, [])).toBe("roll");
  });
});
