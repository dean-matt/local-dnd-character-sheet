import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import {
  featureRestores,
  type RestoreSheet,
  restoredState,
  restoreFor,
} from "./featureRestores.ts";
import { defaultCharacterState } from "./state.ts";
import { definition } from "./test/vex.ts";

const character = (extra: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  ...extra,
});

const levelsOf = (
  className: string,
  source: string,
  count: number,
  subclass?: { name: string; source: string },
) =>
  character({
    levels: Array.from({ length: count }, (_, index) => ({
      class: { name: className, source },
      ...(index === 0 && subclass ? { subclass } : {}),
    })),
  });

const SHEET: RestoreSheet = {
  column: (key) => (key === "martial_arts" ? "1d8" : undefined),
  die: () => undefined,
  modifier: (ability) => ({ str: 0, dex: 2, con: 1, int: 0, wis: 3, cha: 4 })[ability],
  proficiency: 3,
  hitPointMaximum: 61,
};

type Restore = Parameters<typeof restoreFor>[0];

const restoresOf = (held: CharacterDefinition, name: string, sheet = SHEET) =>
  featureRestores(held, sheet).filter(({ feature }) => feature.name === name);

describe("featureRestores", () => {
  it("rolls Second Wind's d10 plus the fighter level", () => {
    expect(restoresOf(levelsOf("Fighter", "PHB", 5), "Second Wind")).toEqual([
      {
        feature: { name: "Second Wind", source: "PHB" },
        kind: "heal",
        dice: "1d10",
        bonus: 5,
        others: false,
      },
    ]);
  });

  it("gives Preserve Life five times the cleric level, to other creatures", () => {
    const life = levelsOf("Cleric", "PHB", 4, { name: "Life Domain", source: "PHB" });
    expect(restoresOf(life, "Channel Divinity: Preserve Life")).toMatchObject([
      { kind: "heal", dice: null, bonus: 20, others: true },
    ]);
  });

  it("lets Hand of Healing, Land's Aid and 2024 Preserve Life land on the character", () => {
    const mercy = levelsOf("Monk", "PHB", 3, { name: "Way of Mercy", source: "TCE" });
    expect(restoresOf(mercy, "Hand of Healing")).toMatchObject([{ kind: "heal", others: false }]);
    const life = levelsOf("Cleric", "XPHB", 3, { name: "Life Domain", source: "XPHB" });
    expect(restoresOf(life, "Preserve Life")).toMatchObject([{ kind: "heal", others: false }]);
    const land = levelsOf("Druid", "XPHB", 3, { name: "Circle of the Land", source: "XPHB" });
    expect(restoresOf(land, "Land's Aid")).toMatchObject([{ kind: "heal", others: false }]);
    const classic = levelsOf("Cleric", "PHB", 2, { name: "Life Domain", source: "PHB" });
    expect(restoresOf(classic, "Channel Divinity: Preserve Life")).toMatchObject([
      { kind: "heal", others: true },
    ]);
  });

  it("scales Fighting Spirit's temporary hit points and Divine Spark's dice by class level", () => {
    const samurai = (level: number) =>
      levelsOf("Fighter", "PHB", level, { name: "Samurai", source: "XGE" });
    expect(restoresOf(samurai(9), "Fighting Spirit")).toMatchObject([
      { kind: "tempHp", dice: null, bonus: 5 },
    ]);
    expect(restoresOf(samurai(15), "Fighting Spirit")).toMatchObject([{ bonus: 15 }]);
    expect(restoresOf(levelsOf("Cleric", "XPHB", 13), "Divine Spark")).toMatchObject([
      { dice: "3d8", bonus: 3, others: true },
    ]);
  });

  it("rolls the Martial Arts die the class table prints, and none where it prints none", () => {
    const monk = levelsOf("Monk", "XPHB", 6, {
      name: "Warrior of the Open Hand",
      source: "XPHB",
    });
    expect(restoresOf(monk, "Wholeness of Body")).toMatchObject([{ dice: "1d8", bonus: 3 }]);
    expect(restoresOf(monk, "Uncanny Metabolism")).toMatchObject([{ dice: "1d8", bonus: 6 }]);
    expect(restoresOf(monk, "Uncanny Metabolism", { ...SHEET, column: () => undefined })).toEqual(
      [],
    );
  });

  it("adds the Charisma modifier to the warlock level for Dark One's Blessing", () => {
    const fiend = levelsOf("Warlock", "PHB", 3, { name: "The Fiend", source: "PHB" });
    expect(restoresOf(fiend, "Dark One's Blessing")).toMatchObject([
      { kind: "tempHp", dice: null, bonus: 7 },
    ]);
  });

  it("restores half the hit point maximum the sheet shows, rounded down", () => {
    const soul = levelsOf("Sorcerer", "PHB", 18, { name: "Divine Soul", source: "XGE" });
    expect(restoresOf(soul, "Unearthly Recovery")).toMatchObject([
      { kind: "heal", dice: null, bonus: 30, others: false },
    ]);
  });

  it("adds the proficiency bonus to Quickened Healing, under the optional class features rule", () => {
    const monk = levelsOf("Monk", "PHB", 4);
    expect(restoresOf(monk, "Quickened Healing")).toEqual([]);
    const optional = { ...monk, houseRules: { optionalClassFeatures: true } };
    expect(restoresOf(optional, "Quickened Healing")).toMatchObject([
      { kind: "heal", dice: "1d8", bonus: 3 },
    ]);
  });

  it("gives other creatures Balm of Peace's healing and Mantle of Inspiration's temporary hit points", () => {
    const peace = levelsOf("Cleric", "XPHB", 3, { name: "Peace Domain", source: "TCE" });
    expect(restoresOf(peace, "Channel Divinity: Balm of Peace")).toMatchObject([
      { kind: "heal", dice: "2d6", bonus: 3, others: true },
    ]);
    const glamour = levelsOf("Bard", "PHB", 10, { name: "College of Glamour", source: "XGE" });
    expect(restoresOf(glamour, "Mantle of Inspiration")).toMatchObject([
      { kind: "tempHp", dice: null, bonus: 11, others: true },
    ]);
  });

  it("gives Symbiotic Entity four temporary hit points per druid level", () => {
    const spores = levelsOf("Druid", "PHB", 3, { name: "Circle of Spores", source: "TCE" });
    expect(restoresOf(spores, "Symbiotic Entity")).toMatchObject([
      { kind: "tempHp", dice: null, bonus: 12 },
    ]);
  });

  it("adds the Charisma modifier to the character's total level for Inspiring Leader", () => {
    const leader = character({
      levels: [
        { class: { name: "Fighter", source: "PHB" } },
        { class: { name: "Fighter", source: "PHB" } },
        { class: { name: "Wizard", source: "PHB" } },
      ],
      feats: [{ ref: { name: "Inspiring Leader", source: "PHB" } }],
    });
    expect(restoresOf(leader, "Inspiring Leader")).toMatchObject([
      { kind: "tempHp", dice: null, bonus: 7, others: false },
    ]);
  });

  it("gives a Half-Orc's Relentless Endurance 1 hit point", () => {
    const orc = character({ race: { name: "Half-Orc", source: "PHB" }, subrace: undefined });
    expect(restoresOf(orc, "Relentless Endurance")).toMatchObject([
      { kind: "heal", dice: null, bonus: 1 },
    ]);
  });
});

describe("restores the player scales", () => {
  const moon = levelsOf("Druid", "PHB", 2, { name: "Circle of the Moon", source: "PHB" });

  it("heals 1d8 for each level of the slot Combat Wild Shape expends", () => {
    const [restore] = restoresOf(moon, "Combat Wild Shape");
    expect(restore).toMatchObject({
      kind: "heal",
      dice: "1d8",
      bonus: 0,
      per: { unit: "slotLevel" },
    });
    expect(restoreFor(restore as Restore, 3)).toEqual({ dice: "3d8", bonus: 0 });
  });

  it("gives Call the Hunt five temporary hit points for each creature, up to the Constitution modifier", () => {
    const beast = levelsOf("Barbarian", "PHB", 14, { name: "Path of the Beast", source: "TCE" });
    const [restore] = restoresOf(beast, "Call the Hunt");
    expect(restore).toMatchObject({ kind: "tempHp", dice: null, bonus: 5 });
    expect(restore?.per).toEqual({ unit: "creature", most: 1 });
    expect(restoreFor(restore as Restore, 1)).toEqual({ dice: null, bonus: 5 });
    const strong = restoresOf(beast, "Call the Hunt", {
      ...SHEET,
      modifier: () => 4,
    });
    expect(strong[0]?.per?.most).toBe(4);
    expect(restoreFor(strong[0] as Restore, 3)).toEqual({ dice: null, bonus: 15 });
  });

  it("gives another creature Rally's superiority die plus the Charisma modifier", () => {
    const rally = { ref: { name: "Rally", source: "PHB" }, featureType: "MV:B" } as never;
    const adept = character({ optionalFeatures: [rally] });
    expect(restoresOf(adept, "Rally")).toMatchObject([
      { kind: "tempHp", dice: "1d6", bonus: 4, others: true },
    ]);
    const master = restoresOf(adept, "Rally", { ...SHEET, die: () => 10 });
    expect(master).toMatchObject([{ dice: "1d10" }]);
  });

  it("restores nothing from Tomb of Levistus without a warlock level", () => {
    const tomb = { ref: { name: "Tomb of Levistus", source: "XGE" }, featureType: "EI" } as never;
    const fighter = character({
      levels: [{ class: { name: "Fighter", source: "PHB" } }],
      optionalFeatures: [tomb],
    });
    expect(restoresOf(fighter, "Tomb of Levistus")).toEqual([]);
  });

  it("gives ten temporary hit points for each warlock level from Tomb of Levistus, whatever the other classes", () => {
    const tomb = { ref: { name: "Tomb of Levistus", source: "XGE" }, featureType: "EI" } as never;
    const multi = character({
      levels: [
        ...Array.from({ length: 3 }, () => ({ class: { name: "Warlock", source: "PHB" } })),
        ...Array.from({ length: 2 }, () => ({ class: { name: "Fighter", source: "PHB" } })),
      ],
      optionalFeatures: [tomb],
    });
    expect(restoresOf(multi, "Tomb of Levistus")).toMatchObject([
      { kind: "tempHp", dice: null, bonus: 30, others: false },
    ]);
  });
});

describe("restoredState", () => {
  const derived = { hitPointMaximum: { computed: 30, manual: null, terms: [] } };
  const at = (current: number | null, temporary: number) => ({
    ...defaultCharacterState(),
    hitPoints: { current, temporary },
  });
  const heal = { kind: "heal", others: false } as const;
  const temp = { kind: "tempHp", others: false } as const;

  it("heals up to the maximum, and at least 1", () => {
    expect(restoredState(derived, at(10, 0), heal, 8)).toEqual({
      state: at(18, 0),
      amount: 8,
    });
    expect(restoredState(derived, at(25, 0), heal, 8).state.hitPoints.current).toBeNull();
    expect(restoredState(derived, at(0, 0), heal, -2)).toMatchObject({
      state: at(1, 0),
      amount: 1,
    });
  });

  it("keeps the higher of the old and new temporary hit points", () => {
    expect(restoredState(derived, at(10, 3), temp, 7).state).toEqual(at(10, 7));
    expect(restoredState(derived, at(10, 9), temp, 7).state).toEqual(at(10, 9));
  });

  it("leaves the state alone for a restore on another creature", () => {
    const state = at(10, 0);
    expect(restoredState(derived, state, { ...heal, others: true }, 20)).toEqual({
      state,
      amount: 20,
    });
    expect(restoredState(derived, state, { ...temp, others: true }, 8).state).toEqual(state);
  });
});
