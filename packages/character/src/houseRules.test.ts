import { describe, expect, it } from "vitest";
import { inspirationEffect } from "./houseRules.ts";

describe("inspirationEffect", () => {
  it("is each edition's printed rule, and the other's under the house rule", () => {
    expect(inspirationEffect("classic", {})).toBe("advantage");
    expect(inspirationEffect("one", {})).toBe("reroll");
    expect(inspirationEffect("classic", { otherEditionInspiration: true })).toBe("reroll");
    expect(inspirationEffect("one", { otherEditionInspiration: true })).toBe("advantage");
  });
});
