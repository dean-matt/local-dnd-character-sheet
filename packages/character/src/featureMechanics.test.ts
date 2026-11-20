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

  it("refuses a proficiency mechanic that grants nothing, and one naming an unknown ability", () => {
    const ref = { name: "Bonus Proficiency", source: "PHB" };
    const parse = (mechanic: object) =>
      featureMechanicsSchema.safeParse({ ref, mechanics: [mechanic] }).success;
    expect(parse({ kind: "proficiency" })).toBe(false);
    expect(parse({ kind: "proficiency", armor: ["heavy"] })).toBe(true);
    expect(parse({ kind: "proficiency", savingThrows: ["luck"] })).toBe(false);
    expect(parse({ kind: "halfProficiency", abilities: ["str"], rounding: "up" })).toBe(true);
    expect(parse({ kind: "halfProficiency", abilities: [], rounding: "up" })).toBe(false);
  });

  it("refuses a pick that cannot carry what it states", () => {
    const ref = { name: "Expertise", source: "PHB" };
    const parse = (pick: object) =>
      featureMechanicsSchema.safeParse({ ref, mechanics: [{ kind: "pick", count: 1, ...pick }] })
        .success;
    expect(parse({ fields: ["expertise"] })).toBe(true);
    expect(parse({ fields: ["skills"], expertise: true })).toBe(true);
    expect(parse({ fields: ["languages"], expertise: true })).toBe(false);
    expect(parse({ fields: ["skills"], types: ["gaming"] })).toBe(false);
    expect(parse({ fields: ["tools"], types: ["gaming"] })).toBe(true);
    expect(parse({ fields: [] })).toBe(false);
  });

  it("refuses a defense mechanic that grants nothing, and an offeredBy that is not a feature key", () => {
    const ref = { name: "Bear", source: "PHB" };
    const parse = (record: object) => featureMechanicsSchema.safeParse({ ref, ...record }).success;
    const mechanics = (defense: object) => ({ mechanics: [{ kind: "defense", ...defense }] });
    expect(parse(mechanics({}))).toBe(false);
    expect(parse(mechanics({ immune: ["poison"] }))).toBe(true);
    expect(parse({ ...mechanics({ resist: ["fire"] }), offeredBy: ref })).toBe(false);
  });

  it("refuses a roll mechanic with both or neither of advantage and a bonus, or one off its roll", () => {
    const ref = { name: "Brave", source: "PHB" };
    const parse = (roll: object) =>
      featureMechanicsSchema.safeParse({ ref, mechanics: [{ kind: "roll", ...roll }] }).success;
    expect(parse({ roll: "save", advantage: true })).toBe(true);
    expect(parse({ roll: "save", bonus: 3 })).toBe(true);
    expect(parse({ roll: "save" })).toBe(false);
    expect(parse({ roll: "save", advantage: true, bonus: 3 })).toBe(false);
    expect(parse({ roll: "check", skills: ["stealth"], advantage: true })).toBe(true);
    expect(parse({ roll: "save", skills: ["stealth"], advantage: true })).toBe(false);
    expect(parse({ roll: "initiative", abilities: ["dex"], advantage: true })).toBe(false);
    expect(parse({ roll: "check", skills: ["stealth"], bonus: 10 })).toBe(true);
    expect(parse({ roll: "check", abilities: ["int"], bonus: 2 })).toBe(false);
    expect(parse({ roll: "initiative", bonus: 2 })).toBe(false);
  });

  it("refuses a restore of nothing, a multiplied die, or a scale it cannot replace", () => {
    const ref = { name: "Second Wind", source: "PHB" };
    const parse = (restore: object) =>
      featureMechanicsSchema.safeParse({ ref, mechanics: [{ kind: "heal", ...restore }] }).success;
    expect(parse({ dice: "1d10", bonus: ["level"] })).toBe(true);
    expect(parse({})).toBe(false);
    expect(parse({ dice: "1d10", times: 2 })).toBe(false);
    expect(parse({ bonus: [5], scales: [{ level: 10, bonus: 10 }] })).toBe(true);
    expect(parse({ bonus: ["level"], scales: [{ level: 10, bonus: 10 }] })).toBe(false);
    expect(parse({ dice: { column: "martial_arts" }, scales: [{ level: 10, dice: "2d8" }] })).toBe(
      false,
    );
    expect(parse({ dice: "1d8", scales: [{ level: 10, dice: "2d8", bonus: 1 }] })).toBe(false);
  });

  it("refuses a uses scale that replaces nothing, a count it cannot replace, or a multiplied number count", () => {
    const ref = { name: "Action Surge", source: "PHB" };
    const parse = (...mechanics: object[]) =>
      featureMechanicsSchema.safeParse({
        ref,
        mechanics: mechanics.map((uses) => ({ kind: "uses", reset: "short", ...uses })),
      }).success;
    expect(parse({ count: 1, scales: [{ level: 17, count: 2 }] })).toBe(true);
    expect(parse({ count: "cha", scales: [{ level: 5, reset: "long" }] })).toBe(true);
    expect(parse({ count: 1, scales: [{ level: 17 }] })).toBe(false);
    expect(parse({ count: "cha", scales: [{ level: 5, count: 2 }] })).toBe(false);
    expect(parse({ count: 1 }, { count: 2 })).toBe(false);
    expect(parse({ count: "proficiency", times: 2 })).toBe(true);
    expect(parse({ count: 2, times: 2 })).toBe(false);
  });

  it("refuses a turn mechanic that changes nothing or more than one thing, or a pact count off attacks", () => {
    const ref = { name: "Extra Attack", source: "PHB" };
    const parse = (turn: object) =>
      featureMechanicsSchema.safeParse({ ref, mechanics: [{ kind: "turn", ...turn }] }).success;
    expect(parse({ attacks: 2 })).toBe(true);
    expect(parse({ attacks: 2, pact: true })).toBe(true);
    expect(parse({ action: true })).toBe(true);
    expect(parse({ bonusAction: ["Dash"] })).toBe(true);
    expect(parse({})).toBe(false);
    expect(parse({ attacks: 1 })).toBe(false);
    expect(parse({ attacks: 2, action: true })).toBe(false);
    expect(parse({ action: true, pact: true })).toBe(false);
    expect(parse({ bonusAction: ["Attack"] })).toBe(false);
  });

  it("refuses a die that is not offered, a scaled bonus, and a bonus after the roll that is not a number", () => {
    const ref = { name: "Homing Strikes", source: "TCE" };
    const parse = (mechanic: object) =>
      featureMechanicsSchema.safeParse({ ref, mechanics: [{ kind: "attack", ...mechanic }] })
        .success;
    expect(parse({ dice: "1d6", option: "after a miss" })).toBe(true);
    expect(parse({ dice: "1d6", afterRoll: true, option: "after a miss" })).toBe(true);
    expect(parse({ attack: 10, afterRoll: true, option: "after a miss" })).toBe(true);
    expect(parse({ dice: "1d6" })).toBe(false);
    expect(parse({ attack: 10, afterRoll: true })).toBe(false);
    expect(parse({ attack: "str", afterRoll: true, option: "after a miss" })).toBe(false);
    expect(parse({ dice: "1d6", attack: 1, option: "after a miss" })).toBe(false);
    expect(parse({ attack: 1, scales: [{ level: 5, dice: "1d8" }], option: "x" })).toBe(false);
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
