import { describe, expect, it } from "vitest";
import { classResourcePools, poolReset } from "./classResources.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { entryKey } from "./keys.ts";
import { definition } from "./test/vex.ts";

const BARBARIAN = { name: "Barbarian", source: "PHB" };
const MONK = { name: "Monk", source: "XPHB" };

const ring = {
  name: "Ring of Ki",
  requiresAttunement: true,
  ac: 0,
  save: 0,
  concentration: 0,
  spellAttack: 0,
  spellSaveDc: 0,
  spellDamage: 0,
  abilityCheck: 0,
  proficiencyBonus: 0,
  grantsProficiency: false,
  grantsLanguage: false,
  resourceBonus: { resource: "Focus Points", amount: 2, class: "Monk" },
};

const levels = (...classes: (typeof BARBARIAN)[]) => ({
  ...definition,
  levels: classes.map((ref) => ({ class: ref })),
});

const pools = (
  def: ReturnType<typeof levels>,
  cells: [typeof BARBARIAN, { key: string; value: string }[]][],
) =>
  classResourcePools(def, {
    classResources: new Map(cells.map(([ref, row]) => [entryKey(ref), row])),
  });

describe("classResourcePools", () => {
  it("gives a Battle Master a Superiority Dice pool whose count and die size grow with Fighter levels", () => {
    const FIGHTER = { name: "Fighter", source: "PHB" };
    const battleMaster = (level: number) =>
      classResourcePools(
        {
          ...definition,
          levels: Array.from({ length: level }, (_, index) => ({
            class: FIGHTER,
            ...(index >= 2 && { subclass: { name: "Battle Master", source: "PHB" } }),
          })),
        },
        { classResources: new Map() },
      );
    const superiority = (count: number, die: number) => [
      {
        class: FIGHTER,
        key: "superiority_dice",
        maximum: { computed: count, manual: null, terms: [] },
        die,
      },
    ];

    expect(battleMaster(2)).toEqual([]);
    expect(battleMaster(3)).toEqual(superiority(4, 8));
    expect(battleMaster(7)).toEqual(superiority(5, 8));
    expect(battleMaster(10)).toEqual(superiority(5, 10));
    expect(battleMaster(15)).toEqual(superiority(6, 10));
    expect(battleMaster(18)).toEqual(superiority(6, 12));
  });

  it("sizes a multiclass Battle Master's Superiority Dice by Fighter levels, under Fighter alone", () => {
    const FIGHTER = { name: "Fighter", source: "PHB" };
    const ROGUE = { name: "Rogue", source: "PHB" };
    const subclass = { name: "Battle Master", source: "PHB" };
    expect(
      classResourcePools(
        {
          ...definition,
          levels: [
            { class: FIGHTER },
            { class: FIGHTER },
            { class: FIGHTER, subclass },
            ...Array.from({ length: 4 }, () => ({ class: ROGUE })),
          ],
        },
        { classResources: new Map() },
      ),
    ).toEqual([
      {
        class: FIGHTER,
        key: "superiority_dice",
        maximum: { computed: 4, manual: null, terms: [] },
        die: 8,
      },
    ]);
  });

  it("restores every pool a feature records on some rest under each edition", () => {
    const keys = FEATURE_MECHANICS.flatMap((record) =>
      mechanicsOfKind(record, "pool").map(({ key }) => key),
    );
    expect(keys).not.toEqual([]);
    for (const key of keys) {
      expect(poolReset(key, "classic"), key).toBeDefined();
      expect(poolReset(key, "one"), key).toBeDefined();
    }
  });

  it("lists each class's pools at its level, leaving out a column that counts no uses", () => {
    expect(
      pools(levels(BARBARIAN, MONK), [
        [
          BARBARIAN,
          [
            { key: "rage_damage", value: "+2" },
            { key: "rages", value: "2" },
          ],
        ],
        [
          MONK,
          [
            { key: "focus_points", value: "2" },
            { key: "martial_arts", value: "1d6" },
          ],
        ],
      ]),
    ).toEqual([
      { class: BARBARIAN, key: "rages", maximum: { computed: 2, manual: null, terms: [] } },
      { class: MONK, key: "focus_points", maximum: { computed: 2, manual: null, terms: [] } },
    ]);
  });

  it("adds an item's resource bonus to that class's pool only, naming the item", () => {
    const cells: [typeof MONK, { key: string; value: string }[]][] = [
      [MONK, [{ key: "focus_points", value: "3" }]],
      [BARBARIAN, [{ key: "rages", value: "2" }]],
    ];
    const catalog = { classResources: new Map(cells.map(([ref, row]) => [entryKey(ref), row])) };
    expect(classResourcePools(levels(MONK, BARBARIAN), catalog, [ring])).toEqual([
      {
        class: MONK,
        key: "focus_points",
        maximum: { computed: 5, manual: null, terms: [{ label: "Ring of Ki", value: 2 }] },
      },
      { class: BARBARIAN, key: "rages", maximum: { computed: 2, manual: null, terms: [] } },
    ]);
    expect(classResourcePools(levels(BARBARIAN), catalog, [ring])[0]?.maximum?.computed).toBe(2);
    const kiRing = { ...ring, resourceBonus: { ...ring.resourceBonus, resource: "Ki" } };
    const kiCatalog = {
      classResources: new Map([[entryKey(MONK), [{ key: "ki_points", value: "3" }]]]),
    };
    expect(classResourcePools(levels(MONK), kiCatalog, [kiRing])[0]?.maximum?.computed).toBe(5);
  });

  it("gives an Unlimited pool no maximum, whatever an item adds", () => {
    const belt = { ...ring, resourceBonus: { resource: "Rages", amount: 1, class: "Barbarian" } };
    const catalog = {
      classResources: new Map([[entryKey(BARBARIAN), [{ key: "rages", value: "Unlimited" }]]]),
    };
    expect(classResourcePools(levels(BARBARIAN), catalog, [belt])).toEqual([
      { class: BARBARIAN, key: "rages", maximum: null },
    ]);
  });

  it("throws on a pool cell that is no count", () => {
    expect(() => pools(levels(BARBARIAN), [[BARBARIAN, [{ key: "rages", value: "1d4" }]]])).toThrow(
      RangeError,
    );
  });
});
