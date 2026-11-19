import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureTurn } from "./featureTurn.ts";
import { definition } from "./test/vex.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const ROGUE = { name: "Rogue", source: "PHB" };
const MONK = { name: "Monk", source: "PHB" };
const WARLOCK = { name: "Warlock", source: "PHB" };

const levels = (...groups: [{ name: string; source: string }, number][]) =>
  groups.flatMap(([owner, count]) => Array.from({ length: count }, () => ({ class: owner })));

const holding = (extra: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  ...extra,
});

describe("featureTurn", () => {
  it("allows one attack and grants no bonus actions below Extra Attack", () => {
    expect(featureTurn(holding({ levels: levels([FIGHTER, 4]) }))).toEqual({
      attacks: 1,
      pactAttacks: null,
      addsAction: [{ name: "Action Surge", source: "PHB" }],
      bonusActions: [],
    });
  });

  it("takes the most attacks any held Extra Attack allows, never their sum", () => {
    expect(featureTurn(holding({ levels: levels([FIGHTER, 5]) })).attacks).toBe(2);
    expect(featureTurn(holding({ levels: levels([FIGHTER, 11], [MONK, 5]) })).attacks).toBe(3);
    expect(featureTurn(holding({ levels: levels([FIGHTER, 20]) })).attacks).toBe(4);
  });

  it("counts Thirsting Blade's attacks for the pact weapon alone, where they are more", () => {
    const blade = [
      {
        featureType: "EI",
        ref: { name: "Thirsting Blade", source: "PHB" },
        grantedBy: { kind: "class" as const, ref: WARLOCK },
      },
    ];
    const warlock = featureTurn(holding({ levels: levels([WARLOCK, 5]), optionalFeatures: blade }));
    expect(warlock).toMatchObject({ attacks: 1, pactAttacks: 2 });
    const both = featureTurn(
      holding({ levels: levels([WARLOCK, 5], [FIGHTER, 5]), optionalFeatures: blade }),
    );
    expect(both).toMatchObject({ attacks: 2, pactAttacks: null });
  });

  it("names each action taken as a bonus action once, with every feature that allows it", () => {
    const turn = featureTurn(holding({ levels: levels([ROGUE, 2], [MONK, 2]) }));
    expect(turn.bonusActions).toEqual([
      { action: "Dash", features: ["Cunning Action", "Step of the Wind"] },
      { action: "Disengage", features: ["Cunning Action", "Step of the Wind"] },
      { action: "Hide", features: ["Cunning Action"] },
      { action: "Dodge", features: ["Patient Defense"] },
    ]);
  });
});
