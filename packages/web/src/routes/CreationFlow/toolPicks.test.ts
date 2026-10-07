import { describe, expect, it } from "vitest";
import { type ToolOffer, tallyTools, toolDeparture, toolsNeeded, toolsSpent } from "./toolPicks.ts";

const MONK: ToolOffer = {
  by: "Class",
  name: "Monk",
  kind: "artisan's tools or musical instruments",
  count: 1,
  options: ["Smith's Tools", "Lute"],
};
const URCHIN: ToolOffer = {
  by: "Background",
  name: "Urchin",
  count: 1,
  options: ["Thieves' Tools", "Disguise Kit"],
};

describe("tallyTools", () => {
  it("spends a held tool against its list whatever its case, and a granted one against none", () => {
    const granted = [{ name: "Thieves' Tools", by: "Class" as const }];
    const tally = tallyTools([MONK, URCHIN], granted, ["lute", "Thieves' Tools", "Herbalism Kit"]);
    expect(tally).toEqual({ picked: [["lute"], []], outside: ["Herbalism Kit"] });
    expect(toolsNeeded(URCHIN, granted)).toBe(1);
    expect(toolsSpent([MONK, URCHIN], granted, tally)).toBe(false);
    expect(toolDeparture([MONK, URCHIN], tally)).toBe(
      "Herbalism Kit taken outside what the class and background offer.",
    );
  });

  it("notes a pick past the count, naming the kind a list holds", () => {
    const tally = tallyTools([MONK], [], ["Lute", "Smith's Tools"]);
    expect(toolsSpent([MONK], [], tally)).toBe(true);
    expect(toolDeparture([MONK], tally)).toBe(
      "2 tools taken from the Monk list of artisan's tools or musical instruments, which offers 1.",
    );
  });
});
