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
      items: [
        { item: "book|xphb", quantity: 1 },
        { item: "parchment|xphb", quantity: 10 },
      ],
      coins: 8,
      instead: 50,
    });
    expect(readEquipment(undefined)).toEqual({ items: [], coins: null, instead: null });
    expect(readEquipment([{ A: ["dagger|xphb"] }])?.items).toEqual([
      { item: "dagger|xphb", quantity: 1 },
    ]);
  });

  it("leaves several alternatives and other keys to the JSON", () => {
    expect(readEquipment([{ _: [], A: [] }])).toBeUndefined();
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
      writeEquipment(acolyte, {
        ...state,
        items: [
          { item: "parchment|xphb", quantity: 3 },
          { item: "robe|xphb", quantity: 2 },
        ],
        coins: 9,
      }),
    ).toEqual([
      {
        A: [
          { item: "parchment|xphb", quantity: 3 },
          { special: "vestments" },
          { value: 900 },
          { item: "robe|xphb", quantity: 2 },
        ],
        B: [{ value: 5000 }],
      },
    ]);
  });

  it("keeps the coin entries past the first, which the form does not show", () => {
    const value = [{ A: [{ value: 100 }, { value: 200 }] }];
    expect(writeEquipment(value, { items: [], coins: 3, instead: null })).toEqual([
      { A: [{ value: 300 }, { value: 200 }] },
    ]);
  });

  it("drops a quantity back to one", () => {
    const state = readEquipment([{ A: [{ item: "rope|xphb", quantity: 2 }] }]);
    if (!state) throw new Error("unreadable");
    expect(
      writeEquipment([{ A: [{ item: "rope|xphb", quantity: 2 }] }], {
        ...state,
        items: [{ item: "rope|xphb", quantity: 1 }],
      }),
    ).toEqual([{ A: [{ item: "rope|xphb" }] }]);
  });

  it("round-trips a classic list under its own key", () => {
    const classic = [{ _: ["dagger|phb", { item: "rope|phb", quantity: 2 }, { value: 1500 }] }];
    const state = readEquipment(classic);
    expect(state).toEqual({
      items: [
        { item: "dagger|phb", quantity: 1 },
        { item: "rope|phb", quantity: 2 },
      ],
      coins: 15,
      instead: null,
    });
    if (!state) throw new Error("unreadable");
    expect(writeEquipment(classic, state)).toEqual(classic);
    expect(writeEquipment(classic, { ...state, items: [] })).toEqual([{ _: [{ value: 1500 }] }]);
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
