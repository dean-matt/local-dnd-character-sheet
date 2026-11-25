import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";

const find = (name: string, className: string, level: number, subclass?: string) =>
  FEATURE_MECHANICS.find(
    ({ ref }) =>
      ref.name === name &&
      "className" in ref &&
      ref.className === className &&
      ref.classSource === "PHB" &&
      ref.level === level &&
      ref.subclass?.shortName === subclass,
  );

describe("the PHB Monk and Sorcerer records", () => {
  it.each([
    ["Unarmored Movement", "Monk", 2, undefined],
    ["Ki-Empowered Strikes", "Monk", 6, undefined],
    ["Timeless Body", "Monk", 15, undefined],
    ["Cloak of Shadows", "Monk", 11, "Shadow"],
    ["Extra Elemental Discipline", "Monk", 17, "Four Elements"],
    ["Sorcery Points", "Sorcerer", 2, undefined],
    ["Metamagic", "Sorcerer", 17, undefined],
    ["Draconic Presence", "Sorcerer", 18, "Draconic"],
    ["Spell Bombardment", "Sorcerer", 18, "Wild"],
  ])("marks %s narrative", (name, className, level, subclass) => {
    expect(find(name, className, level, subclass)?.narrative).toBe(true);
  });
});
