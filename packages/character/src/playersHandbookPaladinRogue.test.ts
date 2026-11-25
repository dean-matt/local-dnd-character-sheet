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

describe("the PHB Paladin and Rogue records", () => {
  it("makes the paladin immune to disease", () => {
    expect(mechanicsOfKind(record("Divine Health", "Paladin", 3), "defense")).toEqual([
      { kind: "defense", conditionImmune: ["disease"] },
    ]);
  });

  it("makes the paladin immune to fear and, under Devotion, to charm", () => {
    expect(mechanicsOfKind(record("Aura of Courage", "Paladin", 10), "defense")).toEqual([
      { kind: "defense", conditionImmune: ["frightened"] },
    ]);
    expect(
      mechanicsOfKind(record("Aura of Devotion", "Paladin", 7, "Devotion"), "defense"),
    ).toEqual([{ kind: "defense", conditionImmune: ["charmed"] }]);
  });

  it("gives the Avenging Angel wings only while it lasts", () => {
    expect(mechanicsOfKind(record("Avenging Angel", "Paladin", 20, "Vengeance"), "speed")).toEqual([
      { kind: "speed", fly: 60, while: "active" },
    ]);
  });

  it("gives the rogue Wisdom saving throw proficiency", () => {
    expect(mechanicsOfKind(record("Slippery Mind", "Rogue", 15), "proficiency")).toEqual([
      { kind: "proficiency", savingThrows: ["wis"] },
    ]);
  });

  it("marks Reliable Talent narrative, a floor on the d20 no roll mechanic names", () => {
    expect(record("Reliable Talent", "Rogue", 11).narrative).toBe(true);
  });
});
