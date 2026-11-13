import { describe, expect, it } from "vitest";
import { classResourcePools } from "./classResources.ts";
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
