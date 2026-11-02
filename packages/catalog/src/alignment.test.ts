import { describe, expect, it } from "vitest";
import { alignmentCode, deityAlignmentCode } from "./alignment";

describe("alignmentCode", () => {
  it.each([
    ["LG", "LG"],
    ["lawful good", "LG"],
    ["Chaotic-Evil", "CE"],
    ["TN", "N"],
    ["true neutral", "N"],
    ["Neutral", "N"],
    ["Neutral Good", "NG"],
    ["N", "N"],
    ["Lawful", "L"],
  ])("reads %s as %s", (text, code) => {
    expect(alignmentCode(text)).toBe(code);
  });

  it.each(["Unaligned", "A", "", "NN", "Good Lawful", "lawful sideways"])(
    "reads %j as no alignment",
    (text) => {
      expect(alignmentCode(text)).toBeUndefined();
    },
  );
});

describe("deityAlignmentCode", () => {
  it("joins the upstream letter list", () => {
    expect(deityAlignmentCode({ alignment: ["N", "G"] })).toBe("NG");
    expect(deityAlignmentCode({ alignment: ["N"] })).toBe("N");
  });

  it("reads nothing from an absent, non-list or non-string alignment", () => {
    expect(deityAlignmentCode({})).toBeUndefined();
    expect(deityAlignmentCode(null)).toBeUndefined();
    expect(deityAlignmentCode({ alignment: "LG" })).toBeUndefined();
    expect(deityAlignmentCode({ alignment: [1, 2] })).toBeUndefined();
  });
});
