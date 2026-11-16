import { describe, expect, it } from "vitest";
import { extraTotal, parseExtraDie } from "./extraDie.ts";

describe("parseExtraDie", () => {
  it.each([
    ["+1d4", "+1d4", 1],
    ["-1d4", "-1d4", 1],
    ["d6", "+1d6", 1],
    [" - 2 D8 ", "-2d8", 2],
  ])("reads %o as %o", (text, notation, count) => {
    expect(parseExtraDie(text)).toEqual({ notation, count });
  });

  it("reads blank as no die", () => {
    expect(parseExtraDie("  ")).toEqual({ notation: "", count: 0 });
  });

  it.each(["4", "+1d", "1d4+2", "bless"])("names %o as not a die", (text) => {
    expect(parseExtraDie(text).error).toContain(text.trim());
  });
});

describe("extraTotal", () => {
  it("signs the last dice", () => {
    const dice = [
      { value: 9, sign: 1 },
      { value: 3, sign: -1 },
    ] as const;
    expect(extraTotal(dice, 1)).toBe(-3);
  });
});
