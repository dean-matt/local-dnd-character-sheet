import type { FeatRecord } from "@dnd/catalog";
import { IMPROVEMENT_FEAT } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { alternativesOf, improvementText, isMade } from "./improvementChoice.ts";

const GRAPPLER = { name: "Grappler", source: "XPHB" };
const ALERT = { name: "Alert", source: "XPHB" };
const FEATS: FeatRecord[] = [
  {
    ...GRAPPLER,
    edition: "one",
    json: { ...GRAPPLER, ability: [{ choose: { from: ["str", "dex"] } }] },
  },
  { ...ALERT, edition: "one", json: ALERT },
];

describe("isMade", () => {
  it("waits on scores until +2 or +1 and +1 are placed", () => {
    expect(isMade(undefined, FEATS, undefined)).toBe(false);
    expect(isMade({ feat: IMPROVEMENT_FEAT, increases: [] }, FEATS, undefined)).toBe(false);
    expect(isMade({ increases: [{ ability: "str", amount: 1 }] }, FEATS, undefined)).toBe(false);
    expect(isMade({ increases: [{ ability: "str", amount: 2 }] }, FEATS, undefined)).toBe(true);
    expect(
      isMade(
        {
          increases: [
            { ability: "str", amount: 1 },
            { ability: "dex", amount: 1 },
          ],
        },
        FEATS,
        undefined,
      ),
    ).toBe(true);
  });

  it("waits on a feat's own increase, and on nothing for a feat that offers none", () => {
    expect(isMade({ feat: GRAPPLER, increases: [] }, FEATS, undefined)).toBe(false);
    expect(
      isMade({ feat: GRAPPLER, increases: [{ ability: "dex", amount: 1 }] }, FEATS, undefined),
    ).toBe(true);
    expect(isMade({ feat: ALERT, increases: [] }, FEATS, undefined)).toBe(true);
  });
});

describe("a feat's fixed increase", () => {
  const ACTOR = { name: "Actor", source: "PHB" };
  const feats: FeatRecord[] = [
    { ...ACTOR, edition: "classic", json: { ...ACTOR, ability: [{ cha: 1 }] } },
  ];
  const totals = (cha: number) => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha });

  it("raises nothing past the cap, and needs nothing placed there", () => {
    expect(alternativesOf({ feat: ACTOR, increases: [] }, feats, totals(19))[0]?.fixed).toEqual({
      cha: 1,
    });
    expect(alternativesOf({ feat: ACTOR, increases: [] }, feats, totals(20))[0]?.fixed).toEqual({});
    expect(isMade({ feat: ACTOR, increases: [] }, feats, totals(20))).toBe(true);
  });

  it("offers a slot only the abilities with room, and needs nothing where none has", () => {
    const capped = { ...totals(10), str: 20, dex: 19 };
    const offered = alternativesOf({ feat: GRAPPLER, increases: [] }, FEATS, capped);
    expect(offered[0]?.slots).toEqual([{ from: ["dex"], amount: 1 }]);
    const full = { ...capped, dex: 20 };
    expect(isMade({ feat: GRAPPLER, increases: [] }, FEATS, full)).toBe(true);
  });
});

describe("improvementText", () => {
  it("names the scores raised, or the feat and what it raised", () => {
    expect(
      improvementText({ feat: IMPROVEMENT_FEAT, increases: [{ ability: "int", amount: 2 }] }),
    ).toBe("+2 Intelligence");
    expect(improvementText({ feat: GRAPPLER, increases: [{ ability: "str", amount: 1 }] })).toBe(
      "Grappler (+1 Strength)",
    );
    expect(improvementText({ feat: ALERT, increases: [] })).toBe("Alert");
  });
});
