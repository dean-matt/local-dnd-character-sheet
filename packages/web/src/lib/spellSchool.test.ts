import { describe, expect, it } from "vitest";
import { schoolName } from "./spellSchool.ts";

describe("schoolName", () => {
  it("spells out a school code, and prints one it does not know as itself", () => {
    expect(schoolName("V")).toBe("Evocation");
    expect(schoolName("P")).toBe("P");
  });
});
