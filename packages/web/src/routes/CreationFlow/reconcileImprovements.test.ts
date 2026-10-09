import { IMPROVEMENT_FEAT, improvementAt, withImprovement } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { reconcileImprovements } from "./reconcileImprovements.ts";

const WIZARD = { name: "Wizard", source: "XPHB" };
const FIGHTER = { name: "Fighter", source: "XPHB" };
const GRAPPLER = { name: "Grappler", source: "XPHB" };
const none = { feats: [], abilityIncreases: [] };
const at4 = { level: 4, cls: WIZARD, classLevel: 4, boon: false, features: [] };

const raised = withImprovement(none, 4, WIZARD, {
  feat: IMPROVEMENT_FEAT,
  increases: [{ ability: "int", amount: 2 }],
});

describe("reconcileImprovements", () => {
  it("keeps a choice its level still grants, unchanged", () => {
    expect(reconcileImprovements(raised, [at4], "one", 4)).toBe(raised);
  });

  it("drops a choice at a level that no longer grants one", () => {
    expect(reconcileImprovements(raised, [], "one", 4)).toEqual(none);
    expect(reconcileImprovements(raised, [], "one", 3)).toEqual(none);
  });

  it("converts scores raised the other edition's way, so changing back restores them", () => {
    const classic = withImprovement(none, 4, WIZARD, {
      increases: [{ ability: "int", amount: 2 }],
    });
    expect(reconcileImprovements(raised, [at4], "classic", 4)).toEqual(classic);
    expect(reconcileImprovements(classic, [at4], "one", 4)).toEqual(raised);
  });

  it("leaves a class's feat at a level that holds no improvement", () => {
    const style = {
      feats: [
        {
          ref: { name: "Archery", source: "XPHB" },
          grantedBy: { kind: "class" as const, ref: FIGHTER },
          level: 1,
        },
      ],
      abilityIncreases: [],
    };
    expect(reconcileImprovements(style, [at4], "one", 4)).toBe(style);
  });

  it("names the class a feat's level now belongs to", () => {
    const feat = withImprovement(none, 4, WIZARD, { feat: GRAPPLER, increases: [] });
    const next = reconcileImprovements(feat, [{ ...at4, cls: FIGHTER }], "one", 4);
    expect(improvementAt(next, 4)).toEqual({ feat: GRAPPLER, increases: [] });
    expect(next.feats[0]?.grantedBy).toEqual({ kind: "class", ref: FIGHTER });
  });
});
