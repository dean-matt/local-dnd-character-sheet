import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { featureMechanicsKey, featureMechanicsSchema } from "./featureMechanics.ts";

describe("featureMechanicsSchema", () => {
  it("accepts a feature's mechanics and a narrative mark, and no other shape", () => {
    const ref = { name: "Ambidextrous", source: "PHB" };
    expect(featureMechanicsSchema.safeParse({ ref, narrative: true }).success).toBe(true);
    expect(featureMechanicsSchema.safeParse({ ref }).success).toBe(false);
    expect(featureMechanicsSchema.safeParse({ ref, mechanics: [], narrative: true }).success).toBe(
      false,
    );
  });

  it("refuses rules prose in a record", () => {
    const ref = { name: "Alert", source: "PHB" };
    const mechanics = [{ kind: "bonus", target: "initiative", value: 5, text: "You gain..." }];
    expect(featureMechanicsSchema.safeParse({ ref, mechanics }).success).toBe(false);
  });

  it("keeps every committed record valid and keyed once", () => {
    for (const entry of FEATURE_MECHANICS)
      expect(featureMechanicsSchema.parse(entry)).toEqual(entry);
    const keys = FEATURE_MECHANICS.map(featureMechanicsKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
