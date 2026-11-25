import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";

const find = (name: string) =>
  FEATURE_MECHANICS.find(
    ({ ref }) => ref.name === name && ref.source === "PHB" && !("className" in ref),
  );

describe("the PHB feat and optional feature records", () => {
  it.each([
    ["Heavily Armored", [{ kind: "proficiency", armor: ["heavy"] }]],
    ["Moderately Armored", [{ kind: "proficiency", armor: ["medium", "shield"] }]],
    ["Linguist", [{ kind: "pick", fields: ["languages"], count: 3 }]],
    ["Skilled", [{ kind: "pick", fields: ["skills", "tools"], count: 3 }]],
    ["Unbroken Air", [{ kind: "dc", ability: "wis", label: "Ki" }]],
  ])("records what %s grants", (name, mechanics) => {
    expect(find(name)?.mechanics).toEqual(mechanics);
  });

  it("gives War Caster advantage on concentration saves", () => {
    expect(find("War Caster")?.mechanics).toEqual([
      expect.objectContaining({ roll: "save", abilities: ["con"], advantage: true }),
    ]);
  });

  it.each(["Sentinel", "Observant", "Agonizing Blast", "Twinned Spell"])(
    "marks %s narrative",
    (name) => {
      expect(find(name)?.narrative).toBe(true);
    },
  );
});
