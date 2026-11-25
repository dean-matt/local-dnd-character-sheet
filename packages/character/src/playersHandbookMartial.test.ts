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

describe("the PHB Fighter and Barbarian records", () => {
  it("gives the barbarian advantage on initiative", () => {
    expect(mechanicsOfKind(record("Feral Instinct", "Barbarian", 7), "roll")).toEqual([
      { kind: "roll", roll: "initiative", advantage: true },
    ]);
  });

  it("ends charm and fear only while raging", () => {
    expect(
      mechanicsOfKind(record("Mindless Rage", "Barbarian", 6, "Berserker"), "defense"),
    ).toEqual([{ kind: "defense", conditionImmune: ["charmed", "frightened"], while: "raging" }]);
  });

  it("offers the Bear aspect's Strength check advantage for heavy work", () => {
    expect(mechanicsOfKind(record("Bear", "Barbarian", 6, "Totem Warrior"), "roll")).toEqual([
      expect.objectContaining({ roll: "check", abilities: ["str"], advantage: true }),
    ]);
  });

  it("has the Battle Master pick one artisan's tool", () => {
    expect(
      mechanicsOfKind(record("Student of War", "Fighter", 3, "Battle Master"), "pick"),
    ).toEqual([{ kind: "pick", fields: ["tools"], count: 1, types: ["artisan"] }]);
  });

  it("marks a repeated Indomitable narrative, its uses scaling on the first", () => {
    expect(record("Indomitable (three uses)", "Fighter", 17).narrative).toBe(true);
  });
});
