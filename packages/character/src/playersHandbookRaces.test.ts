import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";

const find = (name: string) =>
  FEATURE_MECHANICS.find(
    ({ ref, races }) => ref.name === name && ref.source === "PHB" && races !== undefined,
  );

describe("the PHB race trait records", () => {
  it.each([
    ["Dwarven Resilience", "Dwarf|PHB"],
    ["Stout Resilience", "Halfling|PHB|Stout|PHB"],
  ])("gives %s advantage on saves against poison", (name, race) => {
    expect(find(name)?.races).toEqual([race]);
    expect(find(name)?.mechanics).toEqual([
      expect.objectContaining({ roll: "save", advantage: true, against: "against poison" }),
    ]);
  });

  it("gives every dragonborn ancestry a Constitution breath weapon used once a rest", () => {
    const breath = find("Breath Weapon");
    expect(breath?.races).toHaveLength(11);
    expect(breath?.races).toContain("Dragonborn|PHB|Dragonborn (Red)|PHB");
    expect(breath?.mechanics).toEqual([
      { kind: "dc", ability: "con" },
      { kind: "uses", count: 1, reset: "short" },
    ]);
  });

  it.each([
    ["Drow Magic", "Elf|PHB|Drow|PHB"],
    ["Infernal Legacy", "Tiefling|PHB"],
    ["Natural Illusionist", "Gnome|PHB|Forest|PHB"],
    ["Cantrip", "Elf|PHB|High|PHB"],
  ])("gives %s its spells to its race", (name, race) => {
    expect(find(name)?.races).toEqual([race]);
    expect(find(name)?.mechanics).toEqual([{ kind: "spells" }]);
  });

  it.each(["Darkvision", "Savage Attacks", "Stonecunning"])("marks %s narrative", (name) => {
    expect(find(name)?.narrative).toBe(true);
  });
});
