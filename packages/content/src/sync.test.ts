import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import { posix } from "./sync.ts";

describe("posix", () => {
  it("leaves forward-slashed paths alone", () => {
    expect(posix("data/spells/spells-phb.json")).toBe("data/spells/spells-phb.json");
  });

  it("normalises the platform separator so lockfiles are portable", () => {
    const native = ["data", "spells", "spells-phb.json"].join(sep);
    expect(posix(native)).toBe("data/spells/spells-phb.json");
  });
});
