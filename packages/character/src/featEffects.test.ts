import { describe, expect, it } from "vitest";
import {
  featHitPointTerms,
  featInitiativeTerms,
  speedMatchingWalk,
  speedWithFeats,
} from "./featEffects.ts";

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
      expect(speedWithFeats({ walk: 30 }, feats([name, source]), undefined).speed.walk).toBe(40);
  });

  describe("speed from class features", () => {
    const levelled = (
      className: string,
      count: number,
      subclass?: { name: string; source: string },
      houseRules: { optionalClassFeatures?: boolean } = {},
    ) => ({
      ...feats(),
      houseRules,
      levels: Array.from({ length: count }, () => ({
        class: { name: className, source: "PHB" },
        ...(subclass && { subclass }),
      })),
    });

    it("gives a Barbarian 10 feet from 5th level unless heavy armor is worn", () => {
      const named = (heavy: boolean, level: number) =>
        speedWithFeats({ walk: 30 }, levelled("Barbarian", level), heavy ? "heavy" : "medium");
      const fast = named(false, 5);
      expect(fast.speed.walk).toBe(40);
      expect(fast.terms).toEqual([
        {
          label: "Fast Movement: walk 30 to 40",
          value: 10,
          reference: { name: "Fast Movement", source: "PHB" },
        },
      ]);
      expect(named(true, 5)).toEqual({ speed: { walk: 30 }, terms: [], matches: [] });
      expect(named(false, 4).speed.walk).toBe(30);
    });

    it("gives a Scout 10 feet on the walk and on a climbing or swimming speed it has", () => {
      const scout = { name: "Scout", source: "XGE" };
      const base = { walk: 30, swim: 30 };
      const { speed, terms } = speedWithFeats(base, levelled("Rogue", 9, scout), undefined);
      expect(speed).toEqual({ walk: 40, swim: 40 });
      expect(terms.map((t) => t.label)).toEqual([
        "Superior Mobility: walk 30 to 40",
        "Superior Mobility: swim 30 to 40",
      ]);
      expect(speedWithFeats(base, levelled("Rogue", 8, scout), undefined).speed).toEqual(base);
    });

    it("gives Roving only where the table uses optional class features", () => {
      const roving = (houseRules: { optionalClassFeatures?: boolean }) =>
        speedWithFeats(
          { walk: 30, climb: 40 },
          levelled("Ranger", 6, undefined, houseRules),
          undefined,
        );
      const { speed, terms, matches } = roving({ optionalClassFeatures: true });
      expect(speed).toEqual({ walk: 35, climb: 40, swim: 35 });
      expect(terms.map((t) => t.label)).toEqual(["Roving: walk 30 to 35", "Roving: swim 0 to 35"]);
      expect(matches.map(({ mode, name }) => [mode, name])).toEqual([
        ["climb", "Roving"],
        ["swim", "Roving"],
      ]);
      expect(roving({}).matches).toEqual([]);
    });

    it("raises a matched speed to the walk only where it is slower", () => {
      const ref = { name: "Deft Explorer Improvement", source: "TCE" };
      const { speed, terms } = speedMatchingWalk({ walk: 45, climb: 50 }, [
        { mode: "climb", name: "Roving", ref },
        { mode: "swim", name: "Roving", ref },
      ]);
      expect(speed).toEqual({ walk: 45, climb: 50, swim: 45 });
      expect(terms).toEqual([{ label: "Roving: swim 0 to 45", value: 45, reference: ref }]);
    });

    it("gives an Armorer 5 feet in armor where the Infiltrator model is taken, and not Guardian", () => {
      const armorModel = {
        name: "Armor Model",
        source: "TCE",
        className: "Artificer",
        classSource: "TCE",
        subclass: { shortName: "Armorer", source: "TCE" },
        level: 3,
      };
      const armorer = (model: string) => ({
        ...feats(),
        levels: Array.from({ length: 3 }, () => ({
          class: { name: "Artificer", source: "TCE" },
          subclass: { name: "Armorer", source: "TCE" },
        })),
        featureChoices: [{ feature: armorModel, options: [{ name: model, source: "TCE" }] }],
      });
      const infiltrator = speedWithFeats({ walk: 30 }, armorer("Infiltrator"), "light");
      expect(infiltrator.speed.walk).toBe(35);
      expect(infiltrator.terms).toEqual([
        {
          label: "Powered Steps: walk 30 to 35",
          value: 5,
          reference: { name: "Infiltrator", source: "TCE" },
        },
      ]);
      expect(speedWithFeats({ walk: 30 }, armorer("Infiltrator"), undefined).speed.walk).toBe(30);
      expect(speedWithFeats({ walk: 30 }, armorer("Guardian"), "light").speed.walk).toBe(30);
    });
  });

  it("ignores a feat the records do not name", () => {
    const none = feats(["Actor", "PHB"]);
    expect(featInitiativeTerms(none, 3)).toEqual([]);
    expect(featHitPointTerms(none)).toEqual([]);
    expect(speedWithFeats({ walk: 30 }, none, undefined).speed.walk).toBe(30);
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

  it("adds 1 hit point per Sorcerer level for a 2024 Draconic Sorcerer, from level 3", () => {
    const sorcerer = (levels: number) => ({
      ...feats(),
      levels: Array.from({ length: levels }, (_, i) => ({
        class: { name: "Sorcerer", source: "XPHB" },
        ...(i === 0 ? { subclass: { name: "Draconic Sorcery", source: "XPHB" } } : {}),
      })),
    });
    expect(featHitPointTerms(sorcerer(2))).toEqual([]);
    expect(featHitPointTerms(sorcerer(3)).map((t) => t.value)).toEqual([3]);
    expect(featHitPointTerms(sorcerer(4)).map((t) => [t.label, t.value])).toEqual([
      ["Draconic Resilience", 4],
    ]);
  });
});
