import { ABILITIES } from "@dnd/rules";
import { describe, expect, it } from "vitest";
import { abilityIncreasesSchema } from "./index.ts";

describe("abilityIncreasesSchema", () => {
  it("reads a classic race's fixed increases and its choice", () => {
    expect(
      abilityIncreasesSchema.parse({
        ability: [{ cha: 2, choose: { from: ["str", "dex", "con", "int", "wis"], count: 2 } }],
      }),
    ).toEqual([
      {
        fixed: { cha: 2 },
        slots: [
          { from: ["str", "dex", "con", "int", "wis"], amount: 1 },
          { from: ["str", "dex", "con", "int", "wis"], amount: 1 },
        ],
      },
    ]);
  });

  it("reads a choice's amount, and a count it leaves out as one", () => {
    expect(
      abilityIncreasesSchema.parse({
        ability: [{ int: 1, choose: { from: ["dex", "cha"], count: 1, amount: 2 } }],
      }),
    ).toEqual([{ fixed: { int: 1 }, slots: [{ from: ["dex", "cha"], amount: 2 }] }]);
    expect(
      abilityIncreasesSchema.parse({ ability: [{ choose: { from: ["str"], amount: 2 } }] }),
    ).toEqual([{ fixed: {}, slots: [{ from: ["str"], amount: 2 }] }]);
  });

  it("keeps a decrease an old race prints", () => {
    expect(abilityIncreasesSchema.parse({ ability: [{ str: 2, int: -2 }] })).toEqual([
      { fixed: { str: 2, int: -2 }, slots: [] },
    ]);
  });

  it("reads a 2024 background's two weighted alternatives", () => {
    const from = ["str", "con", "cha"];
    expect(
      abilityIncreasesSchema.parse({
        ability: [
          { choose: { weighted: { from, weights: [2, 1] } } },
          { choose: { weighted: { from, weights: [1, 1, 1] } } },
        ],
      }),
    ).toEqual([
      { fixed: {}, slots: [2, 1].map((amount) => ({ from, amount })) },
      { fixed: {}, slots: [1, 1, 1].map((amount) => ({ from, amount })) },
    ]);
  });

  it("offers a lineage race with no increases of its own Tasha's +2 and +1, or +1 to three", () => {
    const alternatives = abilityIncreasesSchema.parse({ name: "Aarakocra", lineage: "VRGR" });
    expect(alternatives.map((each) => each.slots.map((slot) => slot.amount))).toEqual([
      [2, 1],
      [1, 1, 1],
    ]);
    expect(alternatives[0]?.slots[0]?.from).toEqual(ABILITIES);
  });

  it("offers nothing for a row with no increases, or with malformed ones", () => {
    expect(abilityIncreasesSchema.parse({ name: "Elf" })).toEqual([]);
    expect(abilityIncreasesSchema.parse({ ability: [{ choose: { from: ["luck"] } }] })).toEqual([]);
  });
});
