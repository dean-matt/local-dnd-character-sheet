import { IMPROVEMENT_FEAT, improvementAt, withImprovement } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { reconcileImprovements } from "./reconcileImprovements.ts";

const WIZARD = { name: "Wizard", source: "XPHB" };
const FIGHTER = { name: "Fighter", source: "XPHB" };
const GRAPPLER = { name: "Grappler", source: "XPHB" };
const none = { feats: [], abilityIncreases: [] };
const at4 = { level: 4, cls: WIZARD, classLevel: 4, boon: false };

const raised = withImprovement(none, 4, WIZARD, {
  feat: IMPROVEMENT_FEAT,
  increases: [{ ability: "int", amount: 2 }],
});

describe("reconcileImprovements", () => {
  it("keeps a choice its level still grants, unchanged", () => {
    expect(reconcileImprovements(raised, [at4], "one")).toBe(raised);
  });

  it("drops a choice at a level that no longer grants one", () => {
    expect(reconcileImprovements(raised, [], "one")).toEqual(none);
  });

  it("drops scores raised the other edition's way", () => {
    expect(reconcileImprovements(raised, [at4], "classic")).toEqual(none);
    const classic = withImprovement(none, 4, WIZARD, {
      increases: [{ ability: "int", amount: 2 }],
    });
    expect(reconcileImprovements(classic, [at4], "one")).toEqual(none);
  });

  it("names the class a feat's level now belongs to", () => {
    const feat = withImprovement(none, 4, WIZARD, { feat: GRAPPLER, increases: [] });
    const next = reconcileImprovements(feat, [{ ...at4, cls: FIGHTER }], "one");
    expect(improvementAt(next, 4)).toEqual({ feat: GRAPPLER, increases: [] });
    expect(next.feats[0]?.grantedBy).toEqual({ kind: "class", ref: FIGHTER });
  });
});
