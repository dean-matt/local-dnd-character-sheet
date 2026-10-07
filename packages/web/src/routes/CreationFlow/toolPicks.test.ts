import { describe, expect, it } from "vitest";
import {
  type ToolOffer,
  tallyTools,
  toolDeparture,
  toolReplacementOffer,
  toolsNeeded,
  toolsSpent,
} from "./toolPicks.ts";

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

describe("toolReplacementOffer", () => {
  const EVERY = ["Thieves' Tools", "Disguise Kit", "Lute", "Smith's Tools"];

  it("offers any tool for each tool two grants give, whatever its case", () => {
    const granted = [
      { name: "Thieves' Tools", by: "Class" as const },
      { name: "thieves' tools", by: "Background" as const },
    ];
    expect(toolReplacementOffer([MONK], granted, EVERY)).toEqual({
      by: "Replacement",
      name: "Thieves' Tools, granted by both Class and Background",
      count: 1,
      options: EVERY,
    });
  });

  it("offers any tool for each pick a list cannot fill because the grants cover it", () => {
    const granted = ["Thieves' Tools", "Disguise Kit"].map((name) => ({
      name,
      by: "Class" as const,
    }));
    expect(toolReplacementOffer([URCHIN], granted, EVERY)).toMatchObject({
      name: "a pick the Urchin list has no tool left for",
      count: 1,
    });
  });

  it("offers nothing where no tool is gained twice", () => {
    expect(
      toolReplacementOffer([URCHIN], [{ name: "Thieves' Tools", by: "Class" }], EVERY),
    ).toBeUndefined();
  });

  it("notes an overspent replacement", () => {
    const replacement: ToolOffer = { by: "Replacement", name: "", count: 1, options: EVERY };
    const tally = tallyTools([replacement], [], ["Lute", "Disguise Kit"]);
    expect(toolDeparture([replacement], tally)).toBe(
      "2 tools taken in place of tools gained twice, which earn 1.",
    );
  });
});
