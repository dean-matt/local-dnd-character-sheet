import type { FeatRecord } from "@dnd/catalog";
import { IMPROVEMENT_FEAT } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { improvementText, isMade } from "./improvementChoice.ts";

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
    expect(isMade(undefined, FEATS)).toBe(false);
    expect(isMade({ feat: IMPROVEMENT_FEAT, increases: [] }, FEATS)).toBe(false);
    expect(isMade({ increases: [{ ability: "str", amount: 1 }] }, FEATS)).toBe(false);
    expect(isMade({ increases: [{ ability: "str", amount: 2 }] }, FEATS)).toBe(true);
    expect(
      isMade(
        {
          increases: [
            { ability: "str", amount: 1 },
            { ability: "dex", amount: 1 },
          ],
        },
        FEATS,
      ),
    ).toBe(true);
  });

  it("waits on a feat's own increase, and on nothing for a feat that offers none", () => {
    expect(isMade({ feat: GRAPPLER, increases: [] }, FEATS)).toBe(false);
    expect(isMade({ feat: GRAPPLER, increases: [{ ability: "dex", amount: 1 }] }, FEATS)).toBe(
      true,
    );
    expect(isMade({ feat: ALERT, increases: [] }, FEATS)).toBe(true);
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
