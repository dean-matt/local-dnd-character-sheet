import { describe, expect, it } from "vitest";
import { classResourcePools } from "./classResources.ts";
import { entryKey } from "./keys.ts";
import { definition } from "./test/vex.ts";

const BARBARIAN = { name: "Barbarian", source: "PHB" };
const MONK = { name: "Monk", source: "XPHB" };

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

  it("gives an Unlimited pool no maximum", () => {
    expect(pools(levels(BARBARIAN), [[BARBARIAN, [{ key: "rages", value: "Unlimited" }]]])).toEqual(
      [{ class: BARBARIAN, key: "rages", maximum: null }],
    );
  });

  it("throws on a pool cell that is no count", () => {
    expect(() => pools(levels(BARBARIAN), [[BARBARIAN, [{ key: "rages", value: "1d4" }]]])).toThrow(
      RangeError,
    );
  });
});
