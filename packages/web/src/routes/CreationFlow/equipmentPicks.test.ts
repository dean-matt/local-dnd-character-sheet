import { describe, expect, it } from "vitest";
import {
  coins,
  type EquipmentMemory,
  type EquipmentSource,
  isComplete,
  landing,
  withoutLanded,
} from "./equipmentPicks.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const item = (name: string, quantity = 1) =>
  ({ kind: "item", ref: PHB(name), label: name, quantity }) as const;
const held = (name: string, quantity = 1) => ({
  ref: PHB(name),
  quantity,
  carried: true,
  equipped: false,
  attuned: false,
});

const fighter: EquipmentSource = {
  by: "Class",
  row: "Fighter|PHB",
  name: "Fighter",
  goldAlternative: { dice: "5d4", multiplier: 10 },
  groups: [
    [
      { key: "a", items: [item("Chain Mail")] },
      { key: "b", items: [item("Leather Armor"), item("Arrows (20)")] },
    ],
    [
      { key: "a", items: [{ kind: "type", types: ["weaponMartial"], quantity: 2 }] },
      { key: "b", items: [item("Handaxe", 2)] },
    ],
    [{ key: "_", items: [item("Explorer's Pack"), { kind: "money", copper: 1050 }] }],
  ],
};

const memory = (picks: EquipmentMemory["picks"]): EquipmentMemory => ({
  picks,
  landed: [],
  names: {},
});

describe("landing", () => {
  it("lands the chosen options, each copy's slot pick and what is given outright", () => {
    const picks = memory({
      Class: {
        row: "Fighter|PHB",
        options: { 0: "b", 1: "a" },
        slots: { "1:a:0:0": PHB("Longsword"), "1:a:0:1": PHB("Battleaxe") },
      },
    });
    expect(landing([fighter], picks)).toEqual({
      inventory: [
        held("Leather Armor"),
        held("Arrows (20)"),
        held("Longsword"),
        held("Battleaxe"),
        held("Explorer's Pack"),
      ],
      copper: 1050,
    });
  });

  it("lands the gold alternative in place of the class's and the background's equipment", () => {
    const sage: EquipmentSource = {
      by: "Background",
      row: "Sage|PHB",
      name: "Sage",
      groups: [[{ key: "_", items: [item("Pouch"), { kind: "money", copper: 1000 }] }]],
    };
    const taken = { ...memory({}), gold: { row: "Fighter|PHB", gp: 120 } };
    expect(landing([fighter, sage], taken)).toEqual({ inventory: [], copper: 12000 });
    const otherClass = { ...memory({}), gold: { row: "Fighter|XPHB", gp: 120 } };
    expect(landing([fighter, sage], otherClass).copper).toBe(2050);
  });

  it("reads no pick made under another row", () => {
    const picks = memory({ Class: { row: "Fighter|XPHB", options: { 0: "a" }, slots: {} } });
    expect(landing([fighter], picks).inventory).toEqual([held("Explorer's Pack")]);
  });
});

describe("withoutLanded", () => {
  it("takes out one entry for each landed, leaving the player's own", () => {
    const inventory = [held("Rope"), held("Dagger"), held("Dagger")];
    expect(withoutLanded(inventory, [held("Dagger")])).toEqual([held("Rope"), held("Dagger")]);
  });
});

describe("isComplete", () => {
  it("waits on every group and every slot, or the gold alternative", () => {
    const row = "Fighter|PHB";
    expect(
      isComplete([fighter], memory({ Class: { row, options: { 0: "a", 1: "a" }, slots: {} } })),
    ).toBe(false);
    expect(
      isComplete(
        [fighter],
        memory({
          Class: { row, options: { 0: "a", 1: "a" }, slots: { "1:a:0:0": PHB("Longsword") } },
        }),
      ),
    ).toBe(false);
    expect(
      isComplete(
        [fighter],
        memory({
          Class: {
            row,
            options: { 0: "a", 1: "a" },
            slots: { "1:a:0:0": PHB("Longsword"), "1:a:0:1": PHB("Battleaxe") },
          },
        }),
      ),
    ).toBe(true);
    expect(isComplete([fighter], { ...memory({}), gold: { row, gp: 90 } })).toBe(true);
  });
});

describe("coins", () => {
  it("counts copper in the fewest coins below platinum", () => {
    expect(coins(1234)).toEqual({ copper: 4, silver: 3, electrum: 0, gold: 12, platinum: 0 });
  });
});
