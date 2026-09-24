import { describe, expect, it } from "vitest";
import { armorClass } from "./index.ts";

const total = (parts: Parameters<typeof armorClass>[0]) => armorClass(parts).total;

describe("armorClass", () => {
  it.each([
    [-1, 10],
    [0, 11],
    [4, 15],
  ])("adds the whole modifier of %i under light armor", (dexterityModifier, expected) => {
    expect(
      total({
        base: { value: 11 },
        dexterityModifier: { value: dexterityModifier },
        dexterityCap: "all",
      }),
    ).toBe(expected);
  });

  it.each([
    [-1, 14],
    [0, 15],
    [1, 16],
    [2, 17],
    [3, 17],
    [5, 17],
  ])("caps a modifier of %i at +2 under medium armor", (dexterityModifier, expected) => {
    expect(
      total({
        base: { value: 15 },
        dexterityModifier: { value: dexterityModifier },
        dexterityCap: 2,
      }),
    ).toBe(expected);
  });

  it.each([-3, -1, 0, 3])(
    "admits none of a modifier of %i under heavy armor",
    (dexterityModifier) => {
      expect(
        total({
          base: { value: 18 },
          dexterityModifier: { value: dexterityModifier },
          dexterityCap: "none",
        }),
      ).toBe(18);
    },
  );

  it("treats a cap as a ceiling rather than a clamp to itself", () => {
    expect(total({ base: { value: 15 }, dexterityModifier: { value: -2 }, dexterityCap: 2 })).toBe(
      13,
    );
    expect(total({ base: { value: 15 }, dexterityModifier: { value: 0 }, dexterityCap: 0 })).toBe(
      15,
    );
    expect(total({ base: { value: 15 }, dexterityModifier: { value: -2 }, dexterityCap: 0 })).toBe(
      13,
    );
  });

  it.each([-1, 1.5, Number.NaN])("rejects a cap of %s", (dexterityCap) => {
    expect(() =>
      armorClass({ base: { value: 15 }, dexterityModifier: { value: 0 }, dexterityCap }),
    ).toThrow(RangeError);
  });

  it.each([
    ["base", { base: { value: 1.5 }, dexterityModifier: { value: 0 } }],
    ["dexterityModifier", { base: { value: 15 }, dexterityModifier: { value: Number.NaN } }],
    ["shield", { base: { value: 15 }, dexterityModifier: { value: 0 }, shield: { value: 0.5 } }],
    [
      "bonus",
      {
        base: { value: 15 },
        dexterityModifier: { value: 0 },
        bonus: [{ label: "Ring of Protection", value: Number.NaN }],
      },
    ],
  ])("rejects a fractional %s rather than reaching the sheet as one", (_label, parts) => {
    expect(() => armorClass({ ...parts, dexterityCap: "all" })).toThrow(RangeError);
  });

  it("stacks a shield with an armored base", () => {
    expect(
      total({
        base: { value: 18 },
        dexterityModifier: { value: 0 },
        dexterityCap: "none",
        shield: { value: 2 },
      }),
    ).toBe(20);
  });

  it("stacks a shield with an unarmored base", () => {
    expect(
      total({
        base: { value: 10 },
        dexterityModifier: { value: 3 },
        dexterityCap: "all",
        shield: { value: 2 },
      }),
    ).toBe(15);
  });

  it("reaches the printed number for a Barbarian, Mage Armor and Chain Mail", () => {
    expect(
      total({
        base: { value: 10 },
        dexterityModifier: { value: 2 },
        dexterityCap: "all",
        bonus: [{ label: "Constitution", value: 3 }],
      }),
    ).toBe(15);
    expect(
      total({ base: { value: 13 }, dexterityModifier: { value: 2 }, dexterityCap: "all" }),
    ).toBe(15);
    expect(
      total({ base: { value: 16 }, dexterityModifier: { value: 2 }, dexterityCap: "none" }),
    ).toBe(16);
  });

  it("sums more than one flat bonus", () => {
    expect(
      total({
        base: { value: 11 },
        dexterityModifier: { value: 3 },
        dexterityCap: "all",
        bonus: [
          { label: "Defense fighting style", value: 1 },
          { label: "Ring of Protection", value: 1 },
        ],
      }),
    ).toBe(16);
  });

  it("reports a term per part, its total the sum of every term's value", () => {
    const result = armorClass({
      base: { value: 10, reference: { name: "Leather Armor", source: "PHB" } },
      dexterityModifier: { value: 4 },
      dexterityCap: 2,
      shield: { value: 2 },
      bonus: [{ label: "Ring of Protection", value: 1 }],
    });
    expect(result).toEqual({
      total: 15,
      terms: [
        { label: "Armor", value: 10, reference: { name: "Leather Armor", source: "PHB" } },
        { label: "Dexterity", value: 2, reference: undefined },
        { label: "Shield", value: 2, reference: undefined },
        { label: "Ring of Protection", value: 1 },
      ],
    });
    expect(result.total).toBe(result.terms.reduce((sum, term) => sum + term.value, 0));
  });

  it("caps the reported Dexterity term rather than the raw modifier", () => {
    const result = armorClass({
      base: { value: 15 },
      dexterityModifier: { value: 4 },
      dexterityCap: 2,
    });
    expect(result.terms.find((term) => term.label === "Dexterity")?.value).toBe(2);
  });
});
