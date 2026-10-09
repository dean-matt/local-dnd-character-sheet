import { describe, expect, it } from "vitest";
import {
  abilityScoreBreakdown,
  type CharacterDefinition,
  IMPROVEMENT_FEAT,
  improvementAt,
  improvementGrantor,
  withImprovement,
  withoutImprovement,
} from "./index.ts";

const WIZARD = { name: "Wizard", source: "XPHB" };
const FIGHTER = { name: "Fighter", source: "PHB" };
const GRAPPLER = { name: "Grappler", source: "XPHB" };
const SKILLED = { name: "Skilled", source: "XPHB" };
const ACOLYTE = { name: "Acolyte", source: "XPHB" };

const held: Pick<CharacterDefinition, "feats" | "abilityIncreases"> = {
  feats: [{ ref: SKILLED, grantedBy: { kind: "background", ref: ACOLYTE } }],
  abilityIncreases: [{ ability: "int", amount: 2, grantedBy: "background" }],
};

describe("improvements", () => {
  it("stores a 2024 improvement as the feat with its increases at the level", () => {
    const next = withImprovement(held, 4, WIZARD, {
      feat: IMPROVEMENT_FEAT,
      increases: [{ ability: "int", amount: 2 }],
    });
    expect(next.feats).toContainEqual({
      ref: IMPROVEMENT_FEAT,
      grantedBy: { kind: "class", ref: WIZARD },
      level: 4,
    });
    expect(next.abilityIncreases).toContainEqual({
      ability: "int",
      amount: 2,
      grantedBy: "feat",
      level: 4,
    });
    expect(improvementAt(next, 4)).toEqual({
      feat: IMPROVEMENT_FEAT,
      increases: [{ ability: "int", amount: 2 }],
    });
  });

  it("stores a classic improvement taken as scores as increases its class granted", () => {
    const next = withImprovement(held, 6, FIGHTER, {
      increases: [
        { ability: "str", amount: 1 },
        { ability: "con", amount: 1 },
      ],
    });
    expect(next.feats).toEqual(held.feats);
    expect(next.abilityIncreases.filter((increase) => increase.level === 6)).toEqual([
      { ability: "str", amount: 1, grantedBy: "class", level: 6 },
      { ability: "con", amount: 1, grantedBy: "class", level: 6 },
    ]);
  });

  it("replaces one level's choice and leaves every other grant alone", () => {
    const first = withImprovement(held, 4, WIZARD, {
      feat: IMPROVEMENT_FEAT,
      increases: [{ ability: "int", amount: 2 }],
    });
    const eighth = withImprovement(first, 8, WIZARD, {
      feat: GRAPPLER,
      increases: [{ ability: "str", amount: 1 }],
    });
    const changed = withImprovement(eighth, 4, WIZARD, {
      feat: GRAPPLER,
      increases: [],
    });
    expect(improvementAt(changed, 4)).toEqual({ feat: GRAPPLER, increases: [] });
    expect(improvementAt(changed, 8)).toEqual({
      feat: GRAPPLER,
      increases: [{ ability: "str", amount: 1 }],
    });
    expect(withoutImprovement(changed, 4)).toEqual(withoutImprovement(eighth, 4));
    expect(improvementGrantor(changed, 4)).toEqual(WIZARD);
    expect(changed.feats[0]).toEqual(held.feats[0]);
    expect(changed.abilityIncreases[0]).toEqual(held.abilityIncreases[0]);
  });

  it("reads no improvement where nothing was taken, as for a character stored before them", () => {
    expect(improvementAt(held, 4)).toBeUndefined();
  });

  it("names the feat or the improvement on each score's term", () => {
    const next = withImprovement(
      withImprovement(held, 4, WIZARD, {
        feat: IMPROVEMENT_FEAT,
        increases: [{ ability: "str", amount: 2 }],
      }),
      8,
      WIZARD,
      { feat: GRAPPLER, increases: [{ ability: "str", amount: 1 }] },
    );
    const abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    expect(abilityScoreBreakdown({ abilityScores, ...next }, "str")).toEqual({
      total: 13,
      terms: [
        { label: "Base", value: 10 },
        { label: "Ability Score Improvement (level 4)", value: 2 },
        { label: "Grappler (level 8)", value: 1 },
      ],
    });
  });
});
