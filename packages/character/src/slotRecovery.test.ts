import { describe, expect, it } from "vitest";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { featureMechanicsKey } from "./featureMechanics.ts";
import { recoverableSlots, recoveredState, slotRecoveries } from "./slotRecovery.ts";
import { type CharacterState, defaultCharacterState } from "./state.ts";
import { definition } from "./test/vex.ts";

const WIZARD = { name: "Wizard", source: "PHB" };
const DRUID = { name: "Druid", source: "PHB" };

const levelsOf = (
  owner: { name: string; source: string },
  count: number,
  subclass?: { name: string; source: string },
): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: owner,
    ...(index === 0 && subclass ? { subclass } : {}),
  })),
});

const total = (value: number) => ({ computed: value, manual: null, terms: [] });

const sheet: Pick<CharacterDerived, "hitDice" | "spellSlots" | "pactSlots" | "classResources"> = {
  hitDice: [],
  spellSlots: [1, 2, 3, 4, 5, 6].map((level) => ({ level, total: total(2) })),
  pactSlots: null,
  classResources: [],
};

const expending = (spent: Record<number, number>): CharacterState => ({
  ...defaultCharacterState(),
  spellSlots: Object.entries(spent).map(([level, expended]) => ({
    level: Number(level),
    total: 2,
    expended,
  })),
});

const ARCANE = { name: "Arcane Recovery", source: "PHB" };
const recovery = { feature: ARCANE, budget: 3, maxLevel: 5 };

describe("slotRecoveries", () => {
  it("budgets half the wizard level, rounded up, from level 1", () => {
    expect(slotRecoveries(levelsOf(WIZARD, 1))).toEqual([{ ...recovery, budget: 1 }]);
    expect(slotRecoveries(levelsOf(WIZARD, 5))).toEqual([recovery]);
    expect(slotRecoveries(levelsOf(WIZARD, 6))).toEqual([recovery]);
  });

  it("gives Natural Recovery to a Circle of the Land druid from level 2, budgeted by the druid level", () => {
    const land = { name: "Circle of the Land", source: "PHB" };
    expect(slotRecoveries(levelsOf(DRUID, 1, land))).toEqual([]);
    expect(slotRecoveries(levelsOf(DRUID, 4, land))).toEqual([
      { feature: { name: "Natural Recovery", source: "PHB" }, budget: 2, maxLevel: 5 },
    ]);
    expect(slotRecoveries(levelsOf(DRUID, 4))).toEqual([]);
  });

  it("limits each recovery to its feature's once-per-long-rest use", () => {
    for (const name of ["Arcane Recovery", "Natural Recovery"]) {
      const entry = FEATURE_MECHANICS.find(
        (each) => each.ref.name === name && each.ref.source === "PHB",
      );
      expect(entry && featureMechanicsKey(entry)).toBeDefined();
      expect(entry?.mechanics).toContainEqual({ kind: "uses", count: 1, reset: "long" });
    }
  });
});

describe("recoverableSlots", () => {
  it("lists expended slots at or below the highest level", () => {
    expect(recoverableSlots(sheet, expending({ 1: 1, 3: 2, 6: 1 }), recovery)).toEqual([
      { level: 1, expended: 1 },
      { level: 3, expended: 2 },
    ]);
  });
});

describe("recoveredState", () => {
  it("returns the picked slots within the budget", () => {
    const after = recoveredState(sheet, expending({ 1: 2, 2: 1 }), recovery, [
      { level: 1, count: 1 },
      { level: 2, count: 1 },
    ]);
    expect(after.spellSlots.slice(0, 2)).toEqual([
      { level: 1, total: 2, expended: 1 },
      { level: 2, total: 2, expended: 0 },
    ]);
  });

  it.each([
    ["nothing", [], /at least one/],
    ["past the budget", [{ level: 2, count: 2 }], /4 levels/],
    ["a slot not expended", [{ level: 3, count: 1 }], /no level 3/],
    [
      "a level picked twice",
      [
        { level: 1, count: 1 },
        { level: 1, count: 1 },
      ],
      /no level 1/,
    ],
  ])("refuses %s", (_, picks, message) => {
    expect(() => recoveredState(sheet, expending({ 1: 1, 2: 2 }), recovery, picks)).toThrow(
      message,
    );
  });

  it("refuses a level above the highest", () => {
    expect(() =>
      recoveredState(sheet, expending({ 6: 1 }), { ...recovery, budget: 6 }, [
        { level: 6, count: 1 },
      ]),
    ).toThrow(/no level 6/);
  });

  it("refuses more slots than are expended", () => {
    expect(() =>
      recoveredState(sheet, expending({ 1: 1 }), { ...recovery, budget: 4 }, [
        { level: 1, count: 2 },
      ]),
    ).toThrow(/1 expended, 2 picked/);
  });
});
