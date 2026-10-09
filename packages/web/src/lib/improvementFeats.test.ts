import type { FeatRecord } from "@dnd/catalog";
import { withImprovement } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { type Candidate, candidateAt, improvementFeats } from "./improvementFeats.ts";

const feat = (name: string, source: string, json: object = {}): FeatRecord => ({
  name,
  source,
  edition: source === "XPHB" ? "one" : "classic",
  json: { name, source, ...json },
});

const FEATS = [
  feat("Ability Score Improvement", "XPHB", {
    category: "G",
    repeatable: true,
    prerequisite: [{ level: 4 }],
  }),
  feat("Alert", "XPHB", { category: "O" }),
  feat("Archery", "XPHB", { category: "FS", prerequisite: [{ feature: ["Fighting Style"] }] }),
  feat("Boon of Fate", "XPHB", { category: "EB", prerequisite: [{ level: 19 }] }),
  feat("Grappler", "XPHB", {
    category: "G",
    prerequisite: [
      { level: 4, ability: [{ str: 13 }] },
      { level: 4, ability: [{ dex: 13 }] },
    ],
  }),
];

const SCORES = { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 };
const at4: Candidate = {
  edition: "one",
  level: 4,
  classNames: ["Wizard"],
  scores: SCORES,
  totals: SCORES,
  held: [],
};
const names = (candidate: Candidate) => improvementFeats(FEATS, candidate).map(({ name }) => name);

describe("improvementFeats", () => {
  it("offers the general and origin feats a 2024 character qualifies for", () => {
    expect(names(at4)).toEqual(["Alert", "Grappler"]);
  });

  it("offers the boons at 19", () => {
    expect(names({ ...at4, level: 19 })).toEqual(["Alert", "Boon of Fate", "Grappler"]);
  });

  it("leaves out a feat whose scores fall short, unless the scores are unset", () => {
    const weak = { ...SCORES, dex: 12 };
    expect(names({ ...at4, scores: weak })).toEqual(["Alert"]);
    expect(names({ ...at4, scores: undefined })).toEqual(["Alert", "Grappler"]);
  });

  it("leaves out a feat held elsewhere that does not repeat", () => {
    expect(names({ ...at4, held: [{ name: "Alert", source: "XPHB" }] })).toEqual(["Grappler"]);
  });

  it("offers a classic feat whatever its category, by its prerequisites alone", () => {
    const classic = [
      feat("Grappler", "PHB", { prerequisite: [{ ability: [{ str: 13 }] }] }),
      feat("Ritual Caster", "PHB", { prerequisite: [{ ability: [{ int: 13 }, { wis: 13 }] }] }),
      feat("Tough", "PHB"),
    ];
    const scores = { ...SCORES, wis: 13 };
    expect(
      improvementFeats(classic, { ...at4, edition: "classic", scores }).map(({ name }) => name),
    ).toEqual(["Ritual Caster", "Tough"]);
  });
});

describe("candidateAt", () => {
  it("reads the scores and classes reached by the level, and every other increase for the cap", () => {
    const WIZARD = { name: "Wizard", source: "XPHB" };
    const FIGHTER = { name: "Fighter", source: "XPHB" };
    const levels = [...Array.from({ length: 8 }, () => ({ class: WIZARD })), { class: FIGHTER }];
    const none = { feats: [], abilityIncreases: [] };
    const raised = withImprovement(none, 8, WIZARD, {
      increases: [{ ability: "str", amount: 2 }],
    });
    const candidate = candidateAt(
      { edition: "classic", levels, abilityScores: { ...SCORES, str: 12 }, ...raised },
      { level: 4, cls: WIZARD, classLevel: 4, boon: false },
    );
    expect(candidate.scores?.str).toBe(12);
    expect(candidate.totals?.str).toBe(14);
    expect(candidate.classNames).toEqual(["Wizard", "Wizard", "Wizard", "Wizard"]);
  });
});
