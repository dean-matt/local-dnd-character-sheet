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
    expect(featureTurn(holding({ levels: levels([FIGHTER, 4]) }), false)).toEqual({
      attacks: 1,
      pactAttacks: null,
      conditionalAttacks: [],
      addsAction: [{ name: "Action Surge", source: "PHB" }],
      bonusActions: [],
    });
  });

  it("takes the most attacks any held Extra Attack allows, never their sum", () => {
    expect(featureTurn(holding({ levels: levels([FIGHTER, 5]) }), false).attacks).toBe(2);
    expect(featureTurn(holding({ levels: levels([FIGHTER, 11], [MONK, 5]) }), false).attacks).toBe(
      3,
    );
    expect(featureTurn(holding({ levels: levels([FIGHTER, 20]) }), false).attacks).toBe(4);
  });

  it("counts Thirsting Blade's attacks for the pact weapon alone, where they are more", () => {
    const blade = [
      {
        featureType: "EI",
        ref: { name: "Thirsting Blade", source: "PHB" },
        grantedBy: { kind: "class" as const, ref: WARLOCK },
      },
    ];
    const warlock = featureTurn(
      holding({ levels: levels([WARLOCK, 5]), optionalFeatures: blade }),
      false,
    );
    expect(warlock).toMatchObject({ attacks: 1, pactAttacks: 2 });
    const both = featureTurn(
      holding({ levels: levels([WARLOCK, 5], [FIGHTER, 5]), optionalFeatures: blade }),
      false,
    );
    expect(both).toMatchObject({ attacks: 2, pactAttacks: null });
  });

  it("names each action taken as a bonus action once, with every feature that allows it", () => {
    const turn = featureTurn(holding({ levels: levels([ROGUE, 2], [MONK, 2]) }), false);
    expect(turn.bonusActions).toEqual([
      { action: "Dash", features: ["Cunning Action", "Step of the Wind"] },
      { action: "Disengage", features: ["Cunning Action", "Step of the Wind"] },
      { action: "Hide", features: ["Cunning Action"] },
      { action: "Dodge", features: ["Patient Defense"] },
    ]);
  });

  describe("under a condition", () => {
    const subclassed = (
      className: string,
      subclass: { name: string; source: string },
      count: number,
      extra: Partial<CharacterDefinition & { started: ReadonlySet<string> }> = {},
    ) =>
      holding({
        levels: Array.from({ length: count }, (_, index) => ({
          class: { name: className, source: "PHB" },
          ...(index === 0 && { subclass }),
        })),
        ...extra,
      });
    const eagle = {
      featureChoices: [
        {
          feature: {
            name: "Totem Spirit",
            source: "PHB",
            className: "Barbarian",
            classSource: "PHB",
            subclass: { shortName: "Totem Warrior", source: "PHB" },
            level: 3,
          },
          options: [{ name: "Eagle", source: "PHB" }],
        },
      ],
    };
    const totem = { name: "Path of the Totem Warrior", source: "PHB" };
    const dash = (raging: boolean) =>
      featureTurn(subclassed("Barbarian", totem, 3, eagle), raging).bonusActions;

    it("offers Eagle's Dash as a bonus action only while raging without heavy armor", () => {
      expect(dash(true)).toEqual([{ action: "Dash", features: ["Eagle"] }]);
      expect(dash(false)).toEqual([]);
    });

    it("adds Invincible Conqueror's attack to Extra Attack only while it runs", () => {
      const conquest = { name: "Oath of Conquest", source: "XGE" };
      const paladin = (started: string[]) =>
        featureTurn(subclassed("Paladin", conquest, 20, { started: new Set(started) }), false)
          .attacks;
      expect(paladin([])).toBe(2);
      expect(paladin(["Invincible Conqueror"])).toBe(3);
    });

    it("names Astral Barrage's three attacks and its condition, not counting them", () => {
      const astral = { name: "Way of the Astral Self", source: "TCE" };
      const monk = (count: number) => featureTurn(subclassed("Monk", astral, count), false);
      expect(monk(17)).toMatchObject({
        attacks: 2,
        conditionalAttacks: [
          {
            feature: "Awakened Astral Self",
            attacks: 3,
            option: "when every attack is made with your astral arms",
          },
        ],
      });
      expect(monk(11).conditionalAttacks).toEqual([]);
    });

    it("names Distant Strike's third attack one past the count held", () => {
      const walker = { name: "Horizon Walker", source: "XGE" };
      expect(featureTurn(subclassed("Ranger", walker, 11), false)).toMatchObject({
        attacks: 2,
        conditionalAttacks: [
          {
            feature: "Distant Strike",
            attacks: 3,
            option: "against a third creature, after attacking two different ones",
          },
        ],
      });
    });
  });
});
