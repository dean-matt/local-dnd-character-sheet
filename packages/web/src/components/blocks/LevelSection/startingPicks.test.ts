import type { SearchHit } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { NO_GRANTS } from "../../../lib/proficiencyGrants.ts";
import { takenPicks } from "./startingPicks.ts";

const skill = (name: string) => ({ type: "skill", name, source: "XPHB", edition: "one" });
const tool = (name: string) => ({
  type: "item",
  name,
  source: "XPHB",
  edition: "one",
  item: { kinds: ["tool"], rarity: null, category: null, tool: "instrument" },
});
const ref = (name: string) => ({ name, source: "XPHB" });
const skillHits = ["Acrobatics", "Stealth", "Arcana"].map(skill) as unknown as SearchHit[];
const toolHits = ["Lute", "Flute"].map(tool) as unknown as SearchHit[];
const held = (skills: string[], tools: string[] = []) => ({
  ...NO_GRANTS,
  skills: skills.map((name) => ({ ref: ref(name), level: "proficient" as const })),
  tools: tools.map((name) => ({ name, level: "proficient" as const })),
});
const old = {
  startingProficiencies: {
    skills: [{ choose: { from: ["acrobatics", "stealth"], count: 1 } }],
    toolProficiencies: [{ anyMusicalInstrument: 1 }],
  },
};
const taken = (over: Partial<Parameters<typeof takenPicks>[0]>) =>
  takenPicks({
    edition: "one",
    old,
    background: undefined,
    race: undefined,
    skillHits,
    toolHits,
    granted: [],
    held: held([]),
    ...over,
  });

describe("takenPicks", () => {
  it("takes the held skills and tools the old class's lists offer", () => {
    expect(taken({ held: held(["Stealth", "Arcana"], ["Lute"]) })).toEqual({
      skills: [ref("Stealth")],
      tools: ["Lute"],
    });
  });

  it("leaves a skill another source grants outright", () => {
    expect(
      taken({
        held: held(["Stealth"]),
        granted: [
          { ...NO_GRANTS, skills: [{ ref: ref("Stealth"), level: "proficient" as const }] },
        ],
      }).skills,
    ).toEqual([]);
  });

  it("leaves a skill the background's own pick spends once the class's list is full", () => {
    const background = { skillProficiencies: [{ choose: { from: ["acrobatics"], count: 1 } }] };
    expect(taken({ background, held: held(["Stealth", "Acrobatics"]) }).skills).toEqual([
      ref("Stealth"),
    ]);
  });

  it("takes nothing from a class that offers no pick", () => {
    expect(taken({ old: {}, held: held(["Stealth"], ["Lute"]) })).toEqual({
      skills: [],
      tools: [],
    });
  });
});
