import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";

const record = (name: string, subclass: string, level: number, classSource = "PHB") => {
  const found = FEATURE_MECHANICS.find(
    ({ ref }) =>
      ref.name === name &&
      "subclass" in ref &&
      ref.subclass?.shortName === subclass &&
      ref.classSource === classSource &&
      ref.level === level,
  );
  if (!found) throw new Error(`no record for ${name}`);
  return found;
};

describe("the PHB Cleric and Bard records", () => {
  it.each([
    ["Channel Divinity: Radiance of the Dawn", "Light", 2, "PHB"],
    ["Channel Divinity: Radiance of the Dawn", "Light", 3, "XPHB"],
    ["Channel Divinity: Charm Animals and Plants", "Nature", 2, "PHB"],
    ["Channel Divinity: Charm Animals and Plants", "Nature", 3, "XPHB"],
  ])("sets the Cleric spell save DC of %s at %s", (name, subclass, level, classSource) => {
    expect(mechanicsOfKind(record(name, subclass, level, classSource), "dc")).toEqual([
      { kind: "dc", spell: "Cleric" },
    ]);
  });

  it("has the Nature cleric pick a skill and a druid cantrip", () => {
    const acolyte = record("Acolyte of Nature", "Nature", 1);
    expect(mechanicsOfKind(acolyte, "pick")).toEqual([
      expect.objectContaining({
        fields: ["skills"],
        from: ["animal handling", "nature", "survival"],
      }),
    ]);
    expect(mechanicsOfKind(acolyte, "spells")).toEqual([
      { kind: "spells", picks: [{ count: 1, level: 0, from: "Druid" }] },
    ]);
  });

  it("marks the 2024 Cleric's Knowledge Domain row narrative at level 3", () => {
    expect(record("Knowledge Domain", "Knowledge", 3, "XPHB").narrative).toBe(true);
  });
});
