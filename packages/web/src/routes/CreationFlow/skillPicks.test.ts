import { describe, expect, it } from "vitest";
import {
  needed,
  replacementOffer,
  type SkillGrant,
  type SkillOffer,
  skillDeparture,
  skillsSpent,
  tallySkills,
} from "./skillPicks.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const grant = (name: string, by: string): SkillGrant => ({ ref: PHB(name), by });
const EVERY = [
  "Arcana",
  "History",
  "Insight",
  "Investigation",
  "Medicine",
  "Perception",
  "Religion",
  "Stealth",
  "Survival",
].map(PHB);
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

  it("moves a skill two lists hold to the other where the first runs out of room", () => {
    const held = ["Insight", "Religion", "Arcana"].map(PHB);
    expect(tallySkills([wizard, background], [], held).picked).toEqual([
      [PHB("Religion"), PHB("Arcana")],
      [PHB("Insight")],
    ]);
  });

  it("overspends the first list once none has room, and spends nothing on a grant", () => {
    const held = ["Arcana", "History", "Insight", "Stealth"].map(PHB);
    const tally = tallySkills([wizard], [grant("History", "Background")], held);
    expect(tally).toEqual({ picked: [[PHB("Arcana"), PHB("Insight")]], outside: [PHB("Stealth")] });
  });
});

describe("needed", () => {
  it("cuts the count short where the grants cover the list", () => {
    const small: SkillOffer = { ...wizard, options: ["Arcana", "History"].map(PHB) };
    expect(needed(small, [grant("Arcana", "Background")])).toBe(1);
    expect(needed(wizard, [grant("Arcana", "Background")])).toBe(2);
  });
});

describe("replacementOffer", () => {
  it("offers any skill for each skill two grants give", () => {
    const granted = [grant("Perception", "Race"), grant("Perception", "Background")];
    expect(replacementOffer([wizard], granted, EVERY)).toEqual({
      by: "Replacement",
      name: "Perception, granted by both Race and Background",
      count: 1,
      options: EVERY,
    });
  });

  it("offers any skill for each pick a list cannot fill because the grants cover it", () => {
    const granted = ["Arcana", "History", "Insight"].map((name) => grant(name, "Background"));
    expect(replacementOffer([wizard], granted, EVERY)).toMatchObject({
      name: "a pick the Wizard list has no skill left for",
      count: 1,
    });
  });

  it("counts a skill two lists share once when neither list can fill without it", () => {
    const narrow: SkillOffer = { ...background, options: [PHB("Religion")] };
    const granted = ["Arcana", "History", "Insight"].map((name) => grant(name, "Background"));
    expect(replacementOffer([wizard, narrow], granted, EVERY)).toMatchObject({
      name: "2 picks the Wizard and Scribe lists have no skill left for",
      count: 2,
    });
  });

  it("counts a race's pick the grants cover as the class's and background's", () => {
    const elf: SkillOffer = {
      by: "Race",
      name: "Elf",
      count: 1,
      options: ["Insight", "Perception", "Survival"].map(PHB),
    };
    const narrow: SkillOffer = { ...background, options: [PHB("Religion")] };
    const granted = ["Arcana", "History", "Insight", "Perception", "Survival"].map((name) =>
      grant(name, "Background"),
    );
    expect(replacementOffer([wizard, narrow, elf], granted, EVERY)).toMatchObject({
      name: "3 picks the Wizard, Scribe, and Elf lists have no skill left for",
      count: 3,
    });
  });

  it("offers nothing where a grant leaves the list room to pick around it", () => {
    expect(replacementOffer([wizard], [grant("Arcana", "Background")], EVERY)).toBeUndefined();
  });
});

describe("skillsSpent", () => {
  const granted = ["Arcana", "History", "Insight"].map((name) => grant(name, "Background"));
  const offers = [wizard, replacementOffer([wizard], granted, EVERY) as SkillOffer];

  it("waits on the replacement once the list is full", () => {
    const tally = tallySkills(offers, granted, [PHB("Religion")]);
    expect(tally.picked).toEqual([[PHB("Religion")], []]);
    expect(skillsSpent(offers, granted, tally)).toBe(false);
  });

  it("is spent once the replacement takes a skill no list offers, which departs from nothing", () => {
    const tally = tallySkills(offers, granted, [PHB("Religion"), PHB("Stealth")]);
    expect(tally).toEqual({ picked: [[PHB("Religion")], [PHB("Stealth")]], outside: [] });
    expect(skillsSpent(offers, granted, tally)).toBe(true);
    expect(skillDeparture(offers, tally)).toBeUndefined();
  });

  it("is spent where lists sharing skills fill only by moving one between them", () => {
    const held = ["Insight", "Religion", "Arcana"].map(PHB);
    const lists = [wizard, background];
    expect(skillsSpent(lists, [], tallySkills(lists, [], held))).toBe(true);
  });
});

describe("skillDeparture", () => {
  it("notes an overspent list and a skill outside every list", () => {
    const tally = {
      picked: [["Arcana", "History", "Insight"].map(PHB)],
      outside: [PHB("Stealth")],
    };
    expect(skillDeparture([wizard], tally)).toBe(
      "3 skills taken from the Wizard list, which offers 2; Stealth taken outside what the race, class and background offer.",
    );
  });

  it("notes an overspent replacement", () => {
    const replacement: SkillOffer = { by: "Replacement", name: "", count: 1, options: EVERY };
    const tally = { picked: [[PHB("Stealth"), PHB("Survival")]], outside: [] };
    expect(skillDeparture([replacement], tally)).toBe(
      "2 skills taken in place of skills gained twice, which earn 1.",
    );
  });

  it("notes nothing where the picks keep to the counts", () => {
    expect(skillDeparture([wizard], { picked: [[PHB("Arcana")]], outside: [] })).toBeUndefined();
  });
});
