import { describe, expect, it } from "vitest";
import { recoverySummary } from "./recoverySummary.ts";

const change = (key: string, label: string) => ({ key, label, before: "0/1", after: "1/1" });

describe("recoverySummary", () => {
  it("says so when nothing returns", () => {
    expect(recoverySummary([])).toBe("Nothing to recover");
  });

  it("names one, and pact slots as one name", () => {
    expect(recoverySummary([change("pact", "Pact Magic 3rd Level slots")])).toBe(
      "Recover pact slots",
    );
  });

  it("names two", () => {
    expect(
      recoverySummary([change("resource0", "Action Surge"), change("resource1", "Second Wind")]),
    ).toBe("Recover Action Surge and Second Wind");
  });

  it("names two resources sharing a name once", () => {
    expect(recoverySummary([change("resource0", "Ki"), change("resource1", "Ki")])).toBe(
      "Recover Ki",
    );
  });

  it("names two and counts the rest", () => {
    expect(
      recoverySummary([
        change("resource0", "Ki"),
        change("resource1", "Channel Divinity"),
        change("resource2", "Wild Shape"),
        change("pact", "Pact Magic 1st Level slots"),
      ]),
    ).toBe("Recover Ki, Channel Divinity +2 more");
  });
});
