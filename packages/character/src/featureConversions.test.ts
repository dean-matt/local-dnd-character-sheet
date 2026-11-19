import { describe, expect, it } from "vitest";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { conversionOptions, convertedState, featureConversions } from "./featureConversions.ts";
import { type CharacterState, defaultCharacterState } from "./state.ts";
import { definition } from "./test/vex.ts";

const SORCERER = { name: "Sorcerer", source: "PHB" };
const CLERIC = { name: "Cleric", source: "PHB" };
const FONT = { name: "Font of Magic", source: "PHB" };
const HARNESS = "Channel Divinity: Harness Divine Power";

const levelsOf = (
  owner: { name: string; source: string },
  count: number,
  extra: Partial<CharacterDefinition> = {},
): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, () => ({ class: owner })),
  ...extra,
});

const total = (value: number) => ({ computed: value, manual: null, terms: [] });

/** A level 5 sorcerer's sheet: 4, 3 and 2 slots of levels 1 to 3, and 5 sorcery points. */
const sheet: Pick<CharacterDerived, "hitDice" | "spellSlots" | "pactSlots" | "classResources"> = {
  hitDice: [],
  spellSlots: [
    { level: 1, total: total(4) },
    { level: 2, total: total(3) },
    { level: 3, total: total(2) },
  ],
  pactSlots: null,
  classResources: [{ class: SORCERER, key: "sorcery_points", maximum: total(5) }],
};

const font = {
  feature: FONT,
  class: SORCERER,
  pool: "sorcery_points",
  costs: [2, 3, 5, 6, 7],
  refund: true,
};

const holding = (slots: [number, number][], points: number): CharacterState => ({
  ...defaultCharacterState(),
  spellSlots: slots.map(([level, expended]) => ({
    level,
    total: [4, 3, 2][level - 1] ?? 0,
    expended,
  })),
  classResources: [{ class: SORCERER, key: "sorcery_points", maximum: 5, expended: 5 - points }],
});

describe("featureConversions", () => {
  it("reads Font of Magic's PHB rates from a level 2 sorcerer up", () => {
    expect(featureConversions(levelsOf(SORCERER, 1), 2)).toEqual([]);
    expect(featureConversions(levelsOf(SORCERER, 2), 2)).toEqual([font]);
  });

  it("cuts Harness Divine Power at half the proficiency bonus, rounded up, under the optional rule", () => {
    const cleric = (count: number) =>
      levelsOf(CLERIC, count, { houseRules: { optionalClassFeatures: true } });
    const costs = (count: number, proficiency: number) =>
      featureConversions(cleric(count), proficiency).find(({ feature }) => feature.name === HARNESS)
        ?.costs;
    expect(costs(2, 2)).toEqual([1]);
    expect(costs(5, 3)).toEqual([1, 1]);
    expect(costs(17, 6)).toEqual([1, 1, 1]);
    expect(featureConversions(levelsOf(CLERIC, 2), 2)).toEqual([]);
  });
});

describe("conversionOptions", () => {
  it("creates only an expended slot the points pay for, and converts only a slot left", () => {
    const options = conversionOptions(
      sheet,
      holding(
        [
          [1, 1],
          [2, 0],
          [3, 2],
        ],
        4,
      ),
      font,
    );
    expect(options).toEqual([
      { via: "create", level: 1, points: 2, refused: null },
      { via: "create", level: 2, points: 3, refused: "No level 2 slot is expended." },
      { via: "create", level: 3, points: 5, refused: "Sorcery points: 4 left, 5 needed." },
      { via: "refund", level: 1, points: 1, refused: null },
      { via: "refund", level: 2, points: 1, refused: null },
      { via: "refund", level: 3, points: 1, refused: "No level 3 slot left." },
    ]);
  });

  it("costs nothing from a pool the sheet does not count, and refunds nothing into one", () => {
    const harness = { ...font, pool: "channel_divinity", costs: [1, 1], refund: false };
    expect(conversionOptions(sheet, holding([[1, 1]], 5), harness)).toEqual([
      { via: "create", level: 1, points: null, refused: null },
      { via: "create", level: 2, points: null, refused: "No level 2 slot is expended." },
    ]);
  });
});

describe("convertedState", () => {
  it("spends the points and refills the slot in one state", () => {
    const after = convertedState(sheet, holding([[1, 1]], 4), font, { via: "create", level: 1 });
    expect(after.spellSlots).toEqual([{ level: 1, total: 4, expended: 0 }]);
    expect(after.classResources).toEqual([
      { class: SORCERER, key: "sorcery_points", maximum: 5, expended: 3 },
    ]);
  });

  it("expends the slot for points, never past the pool's maximum", () => {
    const after = convertedState(sheet, holding([[3, 0]], 4), font, { via: "refund", level: 3 });
    expect(after.spellSlots.find(({ level }) => level === 3)).toEqual({
      level: 3,
      total: 2,
      expended: 1,
    });
    expect(after.classResources[0]?.expended).toBe(0);
  });

  it("expends the pact slot for points, and never creates one", () => {
    const warlock = { ...sheet, pactSlots: { level: 2, total: total(2) } };
    const state = { ...holding([], 3), pactSlots: { level: 2, total: 2, expended: 1 } };
    const options = conversionOptions(warlock, state, font);
    expect(options.filter(({ via }) => via === "pact")).toEqual([
      { via: "pact", level: 2, points: 2, refused: null },
    ]);
    const after = convertedState(warlock, state, font, { via: "pact", level: 2 });
    expect(after.pactSlots).toEqual({ level: 2, total: 2, expended: 2 });
    expect(after.classResources[0]?.expended).toBe(0);
    expect(conversionOptions(warlock, after, font).at(-1)?.refused).toBe("No pact slot left.");
  });

  it("refuses a trade the options refuse or do not offer", () => {
    const state = holding([[3, 2]], 1);
    expect(() => convertedState(sheet, state, font, { via: "create", level: 1 })).toThrow(
      "Sorcery points: 1 left, 2 needed.",
    );
    expect(() => convertedState(sheet, state, font, { via: "refund", level: 3 })).toThrow(
      "No level 3 slot left.",
    );
    expect(() => convertedState(sheet, state, font, { via: "create", level: 6 })).toThrow(
      RangeError,
    );
  });
});
