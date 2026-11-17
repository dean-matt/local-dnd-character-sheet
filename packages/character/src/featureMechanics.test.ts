import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { featureMechanicsKey, featureMechanicsSchema } from "./featureMechanics.ts";
import { SUBCLASS_NAMES } from "./heldFeatures.ts";

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

  it("refuses a repeated target and a proficiency bonus off initiative", () => {
    const ref = { name: "Alert", source: "PHB" };
    const bonus = (target: string, value: number | string) => ({
      kind: "bonus",
      target,
      value,
    });
    const parse = (mechanics: unknown[]) => featureMechanicsSchema.safeParse({ ref, mechanics });
    expect(parse([bonus("walk", 10), bonus("walk", 5)]).success).toBe(false);
    expect(parse([bonus("walk", "proficiency")]).success).toBe(false);
    expect(parse([bonus("initiative", "proficiency"), bonus("walk", 10)]).success).toBe(true);
  });

  it("keeps every committed record valid and keyed once", () => {
    for (const entry of FEATURE_MECHANICS)
      expect(featureMechanicsSchema.parse(entry)).toEqual(entry);
    const keys = FEATURE_MECHANICS.map(featureMechanicsKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("resolves every subclass feature's short name to the full subclass name", () => {
    for (const { ref } of FEATURE_MECHANICS)
      if ("subclass" in ref && ref.subclass)
        expect(SUBCLASS_NAMES.has(`${ref.subclass.shortName}|${ref.subclass.source}`)).toBe(true);
  });
});
