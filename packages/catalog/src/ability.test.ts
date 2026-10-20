import { describe, expect, it } from "vitest";
import { abilityGrantSchema } from "./index.ts";

describe("abilityGrantSchema", () => {
  it("reads a static score", () => {
    expect(abilityGrantSchema.parse({ ability: { static: { con: 19 } } })).toEqual({
      static: { con: 19 },
      bonus: {},
    });
  });

  it("reads a bonus and the cap beside it", () => {
    expect(abilityGrantSchema.parse({ ability: { str: 2, dex: 1, max: 22 } })).toEqual({
      static: {},
      bonus: { str: 2, dex: 1 },
      max: 22,
    });
  });

  it("reads a choose group, and the bare from form, as a pick", () => {
    expect(
      abilityGrantSchema.parse({ ability: { choose: [{ from: ["str", "dex"], amount: 2 }] } }),
    ).toEqual({ static: {}, bonus: {}, choose: { from: ["str", "dex"], count: 1, amount: 2 } });
    expect(abilityGrantSchema.parse({ ability: { from: ["wis"], count: 2, amount: 3 } })).toEqual({
      static: {},
      bonus: {},
      choose: { from: ["wis"], count: 2, amount: 3 },
    });
  });

  it.each([
    [
      "Deck of Many Things (DMG)",
      { from: ["str", "dex", "con", "int", "wis", "cha"], count: 1, amount: 2 },
    ],
    [
      "Deck of Many Things (XDMG)",
      { from: ["str", "dex", "con", "int", "wis", "cha"], count: 1, amount: 2 },
    ],
    [
      "Book of Vile Darkness (DMG)",
      { choose: [{ from: ["str", "dex", "con", "int", "wis", "cha"], count: 1, amount: 2 }] },
    ],
    [
      "Book of Vile Darkness (XDMG)",
      { choose: [{ from: ["str", "dex", "con", "int", "wis", "cha"], count: 1, amount: 2 }] },
    ],
    [
      "Deck of Several Things (LLK)",
      { choose: [{ from: ["str", "dex", "con", "int", "wis", "cha"], count: 1 }] },
    ],
  ])("reads the pick %s writes", (_row, ability) => {
    expect(abilityGrantSchema.parse({ ability })?.choose?.from).toHaveLength(6);
  });

  it("grants nothing for a row without the field, a potion or a malformed score or pick", () => {
    expect(abilityGrantSchema.parse({})).toBeUndefined();
    expect(abilityGrantSchema.parse({ ability: { choose: [{ from: ["luck"] }] } })).toBeUndefined();
    expect(
      abilityGrantSchema.parse({ type: "P|XPHB", ability: { static: { str: 21 } } }),
    ).toBeUndefined();
    expect(abilityGrantSchema.parse({ ability: { static: { str: "high" } } })).toBeUndefined();
  });
});
