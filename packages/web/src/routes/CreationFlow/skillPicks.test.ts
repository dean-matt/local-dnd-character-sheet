import { describe, expect, it } from "vitest";
import { needed, type SkillOffer, skillDeparture, tallySkills } from "./skillPicks.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const wizard: SkillOffer = {
  by: "Class",
  name: "Wizard",
  count: 2,
  options: ["Arcana", "History", "Insight", "Religion"].map(PHB),
};
const background: SkillOffer = {
  by: "Background",
  name: "Scribe",
  count: 1,
  options: ["Insight", "Religion"].map(PHB),
};

describe("tallySkills", () => {
  it("spends a skill two lists hold on the first with room", () => {
    const held = ["Arcana", "Insight", "Religion"].map(PHB);
    expect(tallySkills([wizard, background], [], held)).toEqual({
      picked: [[PHB("Arcana"), PHB("Insight")], [PHB("Religion")]],
      outside: [],
    });
  });

  it("overspends the first list once none has room, and spends nothing on a grant", () => {
    const held = ["Arcana", "History", "Insight", "Stealth"].map(PHB);
    const tally = tallySkills([wizard], [PHB("History")], held);
    expect(tally).toEqual({ picked: [[PHB("Arcana"), PHB("Insight")]], outside: [PHB("Stealth")] });
  });
});

describe("needed", () => {
  it("cuts the count short where the grants cover the list", () => {
    const small: SkillOffer = { ...wizard, options: ["Arcana", "History"].map(PHB) };
    expect(needed(small, [PHB("Arcana")])).toBe(1);
    expect(needed(wizard, [PHB("Arcana")])).toBe(2);
  });
});

describe("skillDeparture", () => {
  it("notes an overspent list and a skill outside every list", () => {
    const tally = {
      picked: [["Arcana", "History", "Insight"].map(PHB)],
      outside: [PHB("Stealth")],
    };
    expect(skillDeparture([wizard], tally)).toBe(
      "3 skills taken from the Wizard list, which offers 2; Stealth taken outside what the class and background offer.",
    );
  });

  it("notes nothing where the picks keep to the counts", () => {
    expect(skillDeparture([wizard], { picked: [[PHB("Arcana")]], outside: [] })).toBeUndefined();
  });
});
