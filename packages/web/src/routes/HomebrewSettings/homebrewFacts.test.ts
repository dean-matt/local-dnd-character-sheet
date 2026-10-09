import { describe, expect, it } from "vitest";
import { itemFacts, spellFacts } from "./homebrewFacts.ts";

describe("homebrew facts", () => {
  it("states an item's attunement condition and leaves out what it lacks", () => {
    expect(
      itemFacts({ name: "Ring", edition: "one", type: "RG", reqAttune: "by a wizard" }),
    ).toEqual([
      ["Type", "Ring"],
      ["Attunement", "Required by a wizard"],
    ]);
    expect(itemFacts({ name: "Rope", edition: "one", reqAttune: "optional", weight: 10 })).toEqual([
      ["Type", "Other"],
      ["Attunement", "Optional"],
      ["Weight", "10 lb."],
    ]);
  });

  it("names a ritual cantrip, and drops a malformed fact while keeping the rest", () => {
    expect(
      spellFacts({
        name: "Glow",
        edition: "one",
        level: 0,
        school: "V",
        time: [{ number: 1, unit: "action" }],
        range: { distance: "far" },
        duration: [{ type: "instant" }],
        meta: { ritual: true },
      }),
    ).toEqual([
      ["Level", "Cantrip"],
      ["School", "Evocation"],
      ["Casting time", "1 action or ritual"],
      ["Duration", "Instantaneous"],
    ]);
  });
});
