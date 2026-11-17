import { describe, expect, it } from "vitest";
import { featHitPointTerms, featInitiativeTerms, speedWithFeats } from "./featEffects.ts";

const feats = (...names: [string, string][]) => ({
  feats: names.map(([name, source]) => ({ ref: { name, source } })),
  optionalFeatures: [],
  race: { name: "Human", source: "PHB" },
  levels: Array.from({ length: 4 }, () => ({ class: { name: "Fighter", source: "PHB" } })),
});

describe("featEffects", () => {
  it("adds the classic and 2024 Alert initiative bonuses", () => {
    expect(featInitiativeTerms(feats(["Alert", "PHB"]), 3).map((t) => t.value)).toEqual([5]);
    expect(featInitiativeTerms(feats(["Alert", "XPHB"]), 3).map((t) => t.value)).toEqual([3]);
  });

  it("adds 2 hit points per level for Tough in either edition", () => {
    for (const source of ["PHB", "XPHB"])
      expect(featHitPointTerms(feats(["Tough", source])).map((t) => t.value)).toEqual([8]);
  });

  it("raises the walk speed for Mobile and Speedy", () => {
    for (const [name, source] of [
      ["Mobile", "PHB"],
      ["Speedy", "XPHB"],
    ] as [string, string][])
      expect(speedWithFeats({ walk: 30 }, feats([name, source])).speed.walk).toBe(40);
  });

  it("ignores a feat the records do not name", () => {
    const none = feats(["Actor", "PHB"]);
    expect(featInitiativeTerms(none, 3)).toEqual([]);
    expect(featHitPointTerms(none)).toEqual([]);
    expect(speedWithFeats({ walk: 30 }, none).speed.walk).toBe(30);
  });

  it("adds 1 hit point per character level for a Hill Dwarf, and nothing for another dwarf", () => {
    const dwarf = (subrace: string) => ({
      ...feats(),
      race: { name: "Dwarf", source: "PHB" },
      subrace: { name: subrace, source: "PHB" },
    });
    expect(featHitPointTerms(dwarf("Hill")).map((t) => [t.label, t.value])).toEqual([
      ["Dwarven Toughness", 4],
    ]);
    expect(featHitPointTerms(dwarf("Mountain"))).toEqual([]);
  });

  it("adds 1 hit point per Sorcerer level for a Draconic Bloodline, from level 1", () => {
    const sorcerer = (levels: number, multiclass = 0) => ({
      ...feats(),
      levels: [
        ...Array.from({ length: levels }, (_, i) => ({
          class: { name: "Sorcerer", source: "PHB" },
          ...(i === 0 ? { subclass: { name: "Draconic Bloodline", source: "PHB" } } : {}),
        })),
        ...Array.from({ length: multiclass }, () => ({
          class: { name: "Fighter", source: "PHB" },
        })),
      ],
    });
    expect(featHitPointTerms(sorcerer(1)).map((t) => t.value)).toEqual([1]);
    expect(featHitPointTerms(sorcerer(3, 2)).map((t) => [t.label, t.value])).toEqual([
      ["Draconic Resilience", 3],
    ]);
  });
});
