import { describe, expect, it } from "vitest";
import {
  type CasterClassLevel,
  multiclassCasterLevel,
  multiclassSlots,
  spellAttackBonus,
  spellSaveDc,
} from "./spellcasting.ts";

describe("spell math", () => {
  it("derives save DC from proficiency and modifier", () => {
    expect(spellSaveDc(4, 5)).toBe(15);
  });

  it("derives attack bonus from proficiency and modifier", () => {
    expect(spellAttackBonus(4, 5)).toBe(7);
  });
});

describe("multiclassCasterLevel", () => {
  it.each([
    ["full", 1, 1],
    ["full", 20, 20],
    ["1/2", 1, 0],
    ["1/2", 2, 1],
    ["1/2", 3, 1],
    ["1/2", 4, 2],
    ["1/2", 19, 9],
    ["1/2", 20, 10],
    ["artificer", 1, 1],
    ["artificer", 2, 1],
    ["artificer", 3, 2],
    ["artificer", 19, 10],
    ["artificer", 20, 10],
    ["1/3", 1, 0],
    ["1/3", 2, 0],
    ["1/3", 3, 1],
    ["1/3", 5, 1],
    ["1/3", 6, 2],
    ["1/3", 20, 6],
    ["pact", 20, 0],
  ] as const)("%s at level %i contributes %i", (progression, level, expected) => {
    expect(multiclassCasterLevel([{ progression, level }])).toBe(expected);
  });

  it("sums contributions across classes", () => {
    expect(
      multiclassCasterLevel([
        { progression: "full", level: 5 },
        { progression: "1/2", level: 3 },
        { progression: "1/3", level: 4 },
      ]),
    ).toBe(7);
  });

  it("rounds each class separately rather than the total", () => {
    const separately = multiclassCasterLevel([
      { progression: "1/2", level: 3 },
      { progression: "1/2", level: 3 },
    ]);
    expect(separately).toBe(2);
  });

  it("excludes pact magic from the combined pool", () => {
    expect(
      multiclassCasterLevel([
        { progression: "pact", level: 5 },
        { progression: "full", level: 3 },
      ]),
    ).toBe(3);
  });

  it("gives the 2024 paladin the round-up progression its data carries", () => {
    const classic = multiclassCasterLevel([{ progression: "1/2", level: 5 }]);
    const one = multiclassCasterLevel([{ progression: "artificer", level: 5 }]);
    expect([classic, one]).toEqual([2, 3]);
  });

  it("is zero for no classes", () => {
    expect(multiclassCasterLevel([])).toBe(0);
  });

  it.each([0, 21, -1, 1.5])("rejects class level %s", (level) => {
    expect(() => multiclassCasterLevel([{ progression: "full", level }])).toThrow(RangeError);
  });

  it("rejects a progression it does not know", () => {
    const unknown = [{ progression: "quarter", level: 4 }] as unknown as CasterClassLevel[];
    expect(() => multiclassCasterLevel(unknown)).toThrow(/quarter/);
  });

  it.each(["constructor", "toString", "hasOwnProperty"])(
    "rejects %s rather than inheriting it",
    (progression) => {
      const inherited = [{ progression, level: 4 }] as unknown as CasterClassLevel[];
      expect(() => multiclassCasterLevel(inherited)).toThrow(RangeError);
    },
  );

  it("rejects class levels that sum past 20, naming the caster level", () => {
    expect(() =>
      multiclassCasterLevel([
        { progression: "full", level: 12 },
        { progression: "full", level: 12 },
      ]),
    ).toThrow(/24/);
  });
});

describe("multiclassSlots", () => {
  it("grants nothing at caster level 0", () => {
    expect(multiclassSlots(0)).toEqual([]);
  });

  it.each([
    [1, [2]],
    [2, [3]],
    [3, [4, 2]],
    [5, [4, 3, 2]],
    [7, [4, 3, 3, 1]],
    [9, [4, 3, 3, 3, 1]],
    [11, [4, 3, 3, 3, 2, 1]],
    [13, [4, 3, 3, 3, 2, 1, 1]],
    [15, [4, 3, 3, 3, 2, 1, 1, 1]],
    [17, [4, 3, 3, 3, 2, 1, 1, 1, 1]],
    [18, [4, 3, 3, 3, 3, 1, 1, 1, 1]],
    [19, [4, 3, 3, 3, 3, 2, 1, 1, 1]],
    [20, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
  ])("caster level %i grants %j", (casterLevel, totals) => {
    expect(multiclassSlots(casterLevel)).toEqual(
      totals.map((total, index) => ({ level: index + 1, total })),
    );
  });

  it("omits slot levels it grants none of", () => {
    expect(multiclassSlots(4).map((slot) => slot.level)).toEqual([1, 2]);
  });

  it("never takes a slot away as the caster level rises", () => {
    for (let casterLevel = 1; casterLevel < 20; casterLevel += 1) {
      const before = new Map(multiclassSlots(casterLevel).map((s) => [s.level, s.total]));
      for (const slot of multiclassSlots(casterLevel + 1)) {
        expect(slot.total).toBeGreaterThanOrEqual(before.get(slot.level) ?? 0);
      }
    }
  });

  it.each([21, -1, 2.5])("rejects caster level %s", (casterLevel) => {
    expect(() => multiclassSlots(casterLevel)).toThrow(RangeError);
  });
});
