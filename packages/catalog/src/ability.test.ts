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

  it("grants nothing for a row without the field, a pick, a potion or a malformed score", () => {
    expect(abilityGrantSchema.parse({})).toBeUndefined();
    expect(
      abilityGrantSchema.parse({ ability: { choose: [{ from: ["str"], amount: 2 }] } }),
    ).toBeUndefined();
    expect(
      abilityGrantSchema.parse({ type: "P|XPHB", ability: { static: { str: 21 } } }),
    ).toBeUndefined();
    expect(abilityGrantSchema.parse({ ability: { static: { str: "high" } } })).toBeUndefined();
  });
});
