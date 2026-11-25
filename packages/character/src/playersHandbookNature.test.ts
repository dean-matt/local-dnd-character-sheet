import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";

const record = (name: string, className: string, level: number, subclass?: string) => {
  const found = FEATURE_MECHANICS.find(
    ({ ref }) =>
      ref.name === name &&
      "className" in ref &&
      ref.className === className &&
      ref.classSource === "PHB" &&
      ref.level === level &&
      ref.subclass?.shortName === subclass,
  );
  if (!found) throw new Error(`no record for ${name}`);
  return found;
};

describe("the PHB Ranger and Druid records", () => {
  it("counts two Wild Shape uses between rests", () => {
    expect(mechanicsOfKind(record("Wild Shape", "Druid", 2), "uses")).toEqual([
      { kind: "uses", count: 2, reset: "short" },
    ]);
  });

  it("makes the Land druid immune to poison and disease", () => {
    expect(mechanicsOfKind(record("Nature's Ward", "Druid", 10, "Land"), "defense")).toEqual([
      { kind: "defense", immune: ["poison"], conditionImmune: ["disease"] },
    ]);
  });

  it("has the Land druid pick one druid cantrip", () => {
    expect(mechanicsOfKind(record("Bonus Cantrip", "Druid", 2, "Land"), "spells")).toEqual([
      { kind: "spells", picks: [{ count: 1, level: 0, from: "Druid" }] },
    ]);
  });

  it.each([
    ["Favored Enemy and Natural Explorer improvements", 6],
    ["Favored Enemy improvement", 14],
  ])("has %s pick a language", (name, level) => {
    expect(mechanicsOfKind(record(name, "Ranger", level), "pick")).toEqual([
      { kind: "pick", fields: ["languages"], count: 1 },
    ]);
  });

  it("offers the Wisdom modifier of Foe Slayer once a turn", () => {
    const slayer = record("Foe Slayer", "Ranger", 20);
    expect(mechanicsOfKind(slayer, "attack")).toEqual([expect.objectContaining({ attack: "wis" })]);
    expect(mechanicsOfKind(slayer, "extraDamage")).toEqual([
      expect.objectContaining({ dice: "wis", oncePerTurn: true }),
    ]);
  });

  it("marks the Hunter's Evasion narrative", () => {
    expect(record("Evasion", "Ranger", 15, "Hunter").narrative).toBe(true);
  });
});
