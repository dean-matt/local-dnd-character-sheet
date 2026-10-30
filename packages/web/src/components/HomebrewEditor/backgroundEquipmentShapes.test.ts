import { describe, expect, it } from "vitest";
import { equipmentProblem, readEquipment, writeEquipment } from "./backgroundEquipmentShapes.ts";

const acolyte = [
  {
    A: [
      { item: "book|xphb", displayName: "Book (Prayers)" },
      { item: "parchment|xphb", quantity: 10 },
      { special: "vestments" },
      { value: 800 },
    ],
    B: [{ value: 5000 }],
  },
];

describe("readEquipment", () => {
  it("reads items, coins and the gold taken instead", () => {
    expect(readEquipment(acolyte)).toEqual({
      items: ["book|xphb", "parchment|xphb"],
      coins: 8,
      instead: 50,
    });
    expect(readEquipment(undefined)).toEqual({ items: [], coins: null, instead: null });
    expect(readEquipment([{ A: ["dagger|xphb"] }])?.items).toEqual(["dagger|xphb"]);
  });

  it("leaves several alternatives and other keys to the JSON", () => {
    expect(readEquipment([{ _: [] }])).toBeUndefined();
    expect(readEquipment([{ A: [] }, { B: [] }])).toBeUndefined();
    expect(readEquipment([{ A: [], B: [{ item: "x|y" }] }])).toBeUndefined();
  });
});

describe("writeEquipment", () => {
  it("keeps what the form has no control for", () => {
    const state = readEquipment(acolyte);
    if (!state) throw new Error("unreadable");
    expect(writeEquipment(acolyte, state)).toEqual(acolyte);
    expect(
      writeEquipment(acolyte, { ...state, items: ["parchment|xphb", "robe|xphb"], coins: 9 }),
    ).toEqual([
      {
        A: [
          { item: "parchment|xphb", quantity: 10 },
          { special: "vestments" },
          { value: 900 },
          { item: "robe|xphb" },
        ],
        B: [{ value: 5000 }],
      },
    ]);
  });

  it("writes nothing for an empty state", () => {
    expect(writeEquipment(acolyte, { items: [], coins: null, instead: null })).toEqual([
      { A: [{ special: "vestments" }] },
    ]);
    expect(writeEquipment(undefined, { items: [], coins: null, instead: null })).toBeUndefined();
  });
});

describe("equipmentProblem", () => {
  it("refuses coins that are owed", () => {
    expect(equipmentProblem([{ A: [{ value: -100 }] }])).toMatch(/^Coins:/);
    expect(equipmentProblem(acolyte)).toBeUndefined();
  });
});
