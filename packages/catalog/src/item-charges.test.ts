import { describe, expect, it } from "vitest";
import { itemCharges, rechargesOnLongRest } from "./item-charges.ts";

describe("itemCharges", () => {
  it("reads the count, the recharge and a rolled amount", () => {
    expect(
      itemCharges({ charges: 7, recharge: "dawn", rechargeAmount: "{@dice 1d6 + 1}" }),
    ).toEqual({
      max: 7,
      printedMax: 7,
      recharge: "dawn",
      regains: { kind: "roll", notation: "1d6 + 1" },
    });
  });

  it("reads a fixed amount, as a number or a numeric string", () => {
    expect(itemCharges({ charges: 3, recharge: "dusk", rechargeAmount: 2 })?.regains).toEqual({
      kind: "fixed",
      count: 2,
    });
    expect(itemCharges({ charges: 3, recharge: "dawn", rechargeAmount: "5" })?.regains).toEqual({
      kind: "fixed",
      count: 5,
    });
  });

  it("restores everything where no amount reads", () => {
    expect(itemCharges({ charges: 3, recharge: "dawn" })?.regains).toEqual({ kind: "all" });
    expect(
      itemCharges({ charges: 3, recharge: "dawn", rechargeAmount: "{@dice 1d4} + 1" })?.regains,
    ).toEqual({ kind: "all" });
  });

  it("lets an override replace the maximum and keeps the printed one", () => {
    expect(itemCharges({ charges: 7 }, 10)).toMatchObject({ max: 10, printedMax: 7 });
  });

  it("is null where the row prints a recharge and no count, or a recharge it does not know", () => {
    expect(itemCharges({ recharge: "dawn" })).toBeNull();
    expect(itemCharges({ charges: 2, recharge: "noon" })?.recharge).toBeNull();
  });
});

describe("rechargesOnLongRest", () => {
  it("returns every printed recharge but special", () => {
    expect(
      (["dawn", "dusk", "midnight", "restLong", "special", null] as const).map(rechargesOnLongRest),
    ).toEqual([true, true, true, true, false, false]);
  });
});
