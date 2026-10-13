import type { SearchHit } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { skillPickOf, toolPicksOf } from "./entryPicks.ts";

const XPHB = (name: string) => ({ name, source: "XPHB" });
const skill = (name: string, source = "XPHB") =>
  ({ type: "skill", name, source, edition: "one" }) as SearchHit;
const tool = (name: string, kind: string) =>
  ({
    type: "item",
    ...XPHB(name),
    edition: "one",
    item: { kinds: ["tool"], rarity: null, category: null, tool: kind },
  }) as SearchHit;

describe("skillPickOf", () => {
  const hits = [skill("Acrobatics"), skill("Acrobatics", "PHB"), skill("Stealth"), skill("Arcana")];

  it("offers the listed skills the character lacks, in the edition's core book", () => {
    const pick = skillPickOf({ from: ["acrobatics", "stealth"], count: 1 }, hits, [], "one");
    expect(pick).toEqual({ count: 1, options: [XPHB("Acrobatics"), XPHB("Stealth")] });
  });

  it("asks for fewer where the character holds the rest of the list", () => {
    const pick = skillPickOf(
      { from: ["acrobatics", "stealth"], count: 2 },
      hits,
      [XPHB("Stealth")],
      "one",
    );
    expect(pick).toEqual({ count: 1, options: [XPHB("Acrobatics")] });
  });

  it("offers every skill for a pick of any", () => {
    const pick = skillPickOf({ from: null, count: 1 }, hits, [], "one");
    expect(pick.options.map((ref) => ref.name)).toEqual(["Acrobatics", "Stealth", "Arcana"]);
  });
});

describe("toolPicksOf", () => {
  const hits = [
    tool("Lute", "instrument"),
    tool("Flute", "instrument"),
    tool("Thieves' Tools", "other"),
  ];

  it("offers every tool of a kind the character lacks, named as the catalog names it", () => {
    const picks = toolPicksOf(
      [
        { names: [], types: ["instrument"], count: 1 },
        { names: ["thieves' tools"], types: [], count: 1 },
      ],
      hits,
      ["lute"],
    );
    expect(picks).toEqual([
      { count: 1, options: ["Flute"] },
      { count: 1, options: ["Thieves' Tools"] },
    ]);
  });
});
