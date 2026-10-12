import type { ClassGrants } from "@dnd/catalog";
import type { CharacterDerived } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { derivedRecord } from "../../../../test/records.ts";
import { derivedChanges, featuresAt, tableChanges } from "./levelUpChanges.ts";

const field = (computed: number, manual: number | null = null) => ({
  computed,
  manual,
  terms: [],
});

function derived(edit: Partial<CharacterDerived>): CharacterDerived {
  return { ...derivedRecord(), ...edit };
}

describe("derivedChanges", () => {
  it("lists the hit point maximum, proficiency bonus and each slot level that moved", () => {
    const before = derived({
      hitPointMaximum: field(52),
      proficiencyBonus: field(3),
      spellSlots: [{ level: 1, total: field(4) }],
      pactSlots: null,
    });
    const after = derived({
      hitPointMaximum: field(60),
      proficiencyBonus: field(4),
      spellSlots: [
        { level: 1, total: field(4) },
        { level: 2, total: field(2) },
      ],
      pactSlots: { level: 1, total: field(1) },
    });
    expect(derivedChanges(before, after)).toEqual([
      { label: "Hit point maximum", before: "52", after: "60" },
      { label: "Proficiency bonus", before: "+3", after: "+4" },
      { label: "2nd-level spell slots", before: "none", after: "2" },
      { label: "Pact slots", before: "none", after: "1 at 1st level" },
    ]);
  });

  it("shows an override standing beside the computed value it no longer matches", () => {
    const before = derived({ hitPointMaximum: field(52, 70) });
    const after = derived({ hitPointMaximum: field(60, 70) });
    expect(derivedChanges(before, after)).toEqual([
      {
        label: "Hit point maximum",
        before: "70 (your override; computed 52)",
        after: "70 (your override; computed 60)",
      },
    ]);
  });
});

describe("tableChanges", () => {
  it("lists each resource and option count the next row moves, and nothing that stays", () => {
    const before = {
      resources: [
        { resourceKey: "ki_points", value: "7" },
        { resourceKey: "martial_arts", value: "1d6" },
      ],
      optionalFeatures: [{ featureType: "EI", known: 2 }],
    };
    const after = {
      resources: [
        { resourceKey: "ki_points", value: "8" },
        { resourceKey: "martial_arts", value: "1d6" },
      ],
      optionalFeatures: [
        { featureType: "EI", known: 3 },
        { featureType: "PB", known: 1 },
      ],
    };
    expect(tableChanges(before, after)).toEqual([
      { label: "Ki points", before: "7", after: "8" },
      { label: "Eldritch Invocation options known", before: "2", after: "3" },
      { label: "Pact Boon options known", before: "0", after: "1" },
    ]);
  });
});

describe("featuresAt", () => {
  it("names the features gained at the level, once each, without the options offered", () => {
    const feature = (name: string, level: number, offeredBy?: { name: string; source: string }) =>
      ({ name, source: "PHB", level, json: {}, ...(offeredBy && { offeredBy }) }) as never;
    const features: ClassGrants["features"] = [
      feature("Rage", 1),
      feature("Totem Spirit", 3),
      feature("Totem Spirit", 3),
      feature("Bear", 3, { name: "Totem Spirit", source: "PHB" }),
    ];
    expect(featuresAt(features, 3)).toEqual(["Totem Spirit"]);
  });
});
