import { describe, expect, it } from "vitest";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { regainedState, regains } from "./regain.ts";
import { type CharacterState, defaultCharacterState } from "./state.ts";
import { definition } from "./test/vex.ts";

type Regain = CharacterDerived["regains"][number];

const SORCERER = { name: "Sorcerer", source: "PHB" };
const WARLOCK = { name: "Warlock", source: "PHB" };
const FIGHTER = { name: "Fighter", source: "PHB" };

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

const sheet: Pick<
  CharacterDerived,
  "hitDice" | "spellSlots" | "pactSlots" | "classResources" | "limitedUses"
> = {
  hitDice: [],
  spellSlots: [],
  pactSlots: { level: 5, total: total(4) },
  classResources: [
    { class: SORCERER, key: "sorcery_points", maximum: total(20), resets: "long" },
  ] as CharacterDerived["classResources"],
  limitedUses: [
    {
      feature: { name: "Psionic Power", source: "TCE" },
      origin: "subclass",
      level: 3,
      key: "psi",
      count: 6,
      reset: "long",
    },
    {
      feature: { name: "Psionic Power", source: "TCE" },
      origin: "subclass",
      level: 3,
      key: "psi-regain",
      count: 1,
      reset: "short",
      part: "recovery",
    },
  ],
};

const state = (patch: Partial<CharacterState>): CharacterState => ({
  ...defaultCharacterState(),
  ...patch,
});

const first = (held: Regain[]) => held[0] as Regain;
const restoration = first(regains(levelsOf(SORCERER, 20)));
const master = first(regains(levelsOf(WARLOCK, 20)));
const psionic = first(regains(levelsOf(FIGHTER, 3, { name: "Psi Warrior", source: "TCE" })));

describe("regains", () => {
  it("gives each feature its regain from the level it arrives", () => {
    expect(regains(levelsOf(SORCERER, 19))).toEqual([]);
    expect(restoration).toEqual({
      feature: { name: "Sorcerous Restoration", source: "PHB" },
      class: SORCERER,
      target: "pool",
      pool: "sorcery_points",
      count: 4,
    });
    expect(master.target).toBe("pactSlots");
    expect(psionic).toMatchObject({ target: "uses", count: 1 });
  });
});

describe("regainedState", () => {
  it("lowers a pool's spent points by the count, never below none", () => {
    const pool = (expended: number) =>
      state({
        classResources: [{ class: SORCERER, key: "sorcery_points", maximum: 20, expended }],
      });
    expect(regainedState(sheet, pool(9), restoration)?.classResources[0]?.expended).toBe(5);
    expect(regainedState(sheet, pool(3), restoration)?.classResources[0]?.expended).toBe(0);
    expect(regainedState(sheet, pool(0), restoration)).toBeNull();
  });

  it("restores every expended pact slot", () => {
    const spent = state({ pactSlots: { level: 5, total: 4, expended: 3 } });
    expect(regainedState(sheet, spent, master)?.pactSlots?.expended).toBe(0);
    expect(regainedState(sheet, state({}), master)).toBeNull();
  });

  it("restores one use of the feature's main count, not its recovery part", () => {
    const spent = state({
      featureUses: [
        { key: "psi", expended: 4 },
        { key: "psi-regain", expended: 0 },
      ],
    });
    expect(regainedState(sheet, spent, psionic)?.featureUses).toContainEqual({
      key: "psi",
      expended: 3,
    });
    expect(regainedState(sheet, state({}), psionic)).toBeNull();
  });
});
