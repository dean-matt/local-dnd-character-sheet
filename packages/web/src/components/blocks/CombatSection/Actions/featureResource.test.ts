import { type CharacterDerived, defaultCharacterState } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { derivedRecord } from "../../../../test/records.ts";
import { featureResource } from "./featureResource.ts";

const BARBARIAN = { name: "Barbarian", source: "XPHB" };
const FIGHTER = { name: "Fighter", source: "XPHB" };
const MONK = { name: "Monk", source: "XPHB" };
const FIGHTER_G = { class: FIGHTER };

const pool = (key: string, cls: typeof FIGHTER, maximum: number | null) => ({
  class: cls,
  key,
  maximum: maximum === null ? null : { computed: maximum, manual: null, terms: [] },
});

const derivedWith = (
  classResources: ReturnType<typeof pool>[],
  heavyArmorWorn = false,
): CharacterDerived => ({ ...derivedRecord(), classResources, heavyArmorWorn });

const RAGE = { name: "Rage", source: "XPHB", uses: undefined };
const SECOND_WIND = { name: "Second Wind", source: "XPHB", uses: undefined };

describe("featureResource", () => {
  it("starts a rage with its use and refuses a second while raging", () => {
    const derived = derivedWith([pool("rages", BARBARIAN, 2)]);
    const stored = defaultCharacterState();
    const rage = featureResource(derived, stored, "one", RAGE, { class: BARBARIAN });

    expect(rage).toMatchObject({ left: 2, total: 2, blocked: null });
    const raging = rage?.spend(stored);
    expect(raging?.classResources[0]?.expended).toBe(1);
    expect(raging?.activeEffects).toEqual([{ name: "Rage" }]);

    const again = featureResource(derived, raging ?? stored, "one", RAGE, { class: BARBARIAN });
    expect(again?.blocked).toBe("Already raging.");
  });

  it("refuses a rage in heavy armor", () => {
    const derived = derivedWith([pool("rages", BARBARIAN, 2)], true);
    const rage = featureResource(derived, defaultCharacterState(), "one", RAGE, {
      class: BARBARIAN,
    });
    expect(rage?.blocked).toBe("Heavy armor is worn.");
  });

  it("spends nothing from an unlimited pool", () => {
    const derived = derivedWith([pool("rages", BARBARIAN, null)]);
    const stored = defaultCharacterState();
    const rage = featureResource(derived, stored, "one", RAGE, { class: BARBARIAN });

    expect(rage).toMatchObject({ left: null, total: null, blocked: null });
    expect(rage?.spend(stored).classResources).toEqual(stored.classResources);

    const wind = featureResource(
      derivedWith([pool("second_wind", FIGHTER, null)]),
      stored,
      "one",
      SECOND_WIND,
      { class: FIGHTER },
    );
    expect(wind?.spend(stored)).toBe(stored);
  });

  it("prefers the pool of the class the feature came from", () => {
    const derived = derivedWith([pool("second_wind", MONK, 5), pool("second_wind", FIGHTER, 2)]);
    const resource = featureResource(derived, defaultCharacterState(), "one", SECOND_WIND, {
      class: FIGHTER,
    });
    expect(resource?.total).toBe(2);
  });

  it("falls back to the first pool when the group names no class", () => {
    const derived = derivedWith([pool("second_wind", MONK, 5), pool("second_wind", FIGHTER, 2)]);
    const resource = featureResource(derived, defaultCharacterState(), "one", SECOND_WIND, {
      class: undefined,
    });
    expect(resource?.total).toBe(5);
  });

  it("spends the catalog's uses where the character lacks the pool, and nothing where there are none", () => {
    const derived = derivedWith([]);
    const stored = defaultCharacterState();
    const uses = { key: "feature|Fighter|XPHB|Second Wind", count: 1, reset: "short" as const };

    const counted = featureResource(derived, stored, "one", { ...SECOND_WIND, uses }, FIGHTER_G);
    expect(counted).toMatchObject({ left: 1, total: 1, rest: "Short rest" });
    expect(featureResource(derived, stored, "one", SECOND_WIND, FIGHTER_G)).toBeNull();
  });
});
