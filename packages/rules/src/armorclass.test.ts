import { describe, expect, it } from "vitest";
import { armorClass } from "./index.ts";

describe("armorClass", () => {
  it.each([
    [-1, 10],
    [0, 11],
    [4, 15],
  ])("adds the whole modifier of %i under uncapped light armor", (dexterityModifier, expected) => {
    expect(armorClass({ base: 11, dexterityModifier })).toBe(expected);
  });

  it.each([
    [-1, 14],
    [0, 15],
    [1, 16],
    [2, 17],
    [3, 17],
    [5, 17],
  ])("caps a modifier of %i at +2 under medium armor", (dexterityModifier, expected) => {
    expect(armorClass({ base: 15, dexterityModifier, dexterityCap: 2 })).toBe(expected);
  });

  it.each([-3, -1, 0, 3])(
    "admits none of a modifier of %i under heavy armor",
    (dexterityModifier) => {
      expect(armorClass({ base: 18, dexterityModifier, dexterityCap: "none" })).toBe(18);
    },
  );

  it("treats a cap as a ceiling rather than a clamp to itself", () => {
    expect(armorClass({ base: 15, dexterityModifier: -2, dexterityCap: 2 })).toBe(13);
    expect(armorClass({ base: 15, dexterityModifier: 0, dexterityCap: 0 })).toBe(15);
    expect(armorClass({ base: 15, dexterityModifier: -2, dexterityCap: 0 })).toBe(13);
  });

  it.each([-1, 1.5, Number.NaN])("rejects a cap of %s", (dexterityCap) => {
    expect(() => armorClass({ base: 15, dexterityModifier: 0, dexterityCap })).toThrow(RangeError);
  });

  it("stacks a shield with an armored base", () => {
    expect(armorClass({ base: 18, dexterityModifier: 0, dexterityCap: "none", shield: 2 })).toBe(
      20,
    );
  });

  it("stacks a shield with an unarmored base", () => {
    expect(armorClass({ base: 10, dexterityModifier: 3, shield: 2 })).toBe(15);
  });

  it("takes one base, so an unarmored formula replaces the armored one rather than adding to it", () => {
    expect(armorClass({ base: 10, dexterityModifier: 2, bonus: 3 })).toBe(15);
    expect(armorClass({ base: 13, dexterityModifier: 2 })).toBe(15);
    expect(armorClass({ base: 16, dexterityModifier: 2, dexterityCap: "none" })).toBe(16);
  });

  it("adds a flat bonus to every form", () => {
    expect(armorClass({ base: 11, dexterityModifier: 3, bonus: 1 })).toBe(15);
    expect(armorClass({ base: 18, dexterityModifier: 3, dexterityCap: "none", bonus: 1 })).toBe(19);
  });
});
