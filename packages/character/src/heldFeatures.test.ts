import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import type { Mechanic } from "./featureMechanics.ts";
import {
  featurePickOffers,
  featureSpellPickOffers,
  heldFeatures,
  learnedSpells,
  raceSpellCasts,
  spellGrantRecord,
} from "./heldFeatures.ts";
import { refKey } from "./keys.ts";
import type { ContentRef } from "./refs.ts";
import { definition } from "./test/vex.ts";

const raceTraits = FEATURE_MECHANICS.flatMap(({ ref, races, level }) =>
  (races ?? []).map((owner) => [ref.name, owner, level ?? 1] as const),
);

const heldBy = (owner: string, level = 1) => {
  const [race, raceSource, subrace, subraceSource] = owner.split("|");
  return heldFeatures({
    ...definition,
    feats: [],
    optionalFeatures: [],
    race: { name: race ?? "", source: raceSource ?? "" },
    subrace: subrace && subraceSource ? { name: subrace, source: subraceSource } : undefined,
    levels: Array.from({ length: level }, () => ({ class: { name: "Fighter", source: "PHB" } })),
  }).filter(({ origin }) => origin === "race");
};

describe("a racial trait", () => {
  it("is held, as a race trait, by every race that records it", () => {
    expect(raceTraits.length).toBeGreaterThanOrEqual(5);
    for (const [name, owner, level] of raceTraits)
      expect(heldBy(owner, level).map(({ ref }) => ref.name)).toContain(name);
  });

  it("is not held by a race that does not record it", () => {
    expect(heldBy("Human|PHB")).toEqual([]);
    expect(heldBy("Dwarf|PHB").map(({ ref }) => ref.name)).not.toContain("Dwarven Toughness");
  });
});

describe("a homebrew effect", () => {
  const ruling = (ref: ContentRef, mechanics: Mechanic[]) => new Map([[refKey(ref), mechanics]]);
  const bard = { className: "Bard", classSource: "PHB" };

  it("replaces the spell picks a class feature records", () => {
    const secrets = { ...bard, name: "Magical Secrets", source: "PHB", level: 10 };
    const picks = [{ count: 3, from: "Bard" }];
    expect(featureSpellPickOffers(secrets)).toEqual([{ count: 2, from: "any" }]);
    expect(featureSpellPickOffers(secrets, ruling(secrets, [{ kind: "spells", picks }]))).toEqual(
      picks,
    );
  });

  it("replaces the picks a class feature records", () => {
    const expertise = { ...bard, name: "Expertise", source: "PHB", level: 3 };
    expect(featurePickOffers(expertise)).toHaveLength(1);
    expect(featurePickOffers(expertise, ruling(expertise, []))).toEqual([]);
  });

  it("replaces how a feature's granted spells are cast, and gives way once removed", () => {
    const chains = { name: "Chains of Carceri", source: "PHB" };
    const effect = ruling(chains, [
      { kind: "spells", casting: "slot" },
      { kind: "uses", count: 1, reset: "long" },
    ]);
    expect(spellGrantRecord(chains, effect)).toEqual({
      casting: "slot",
      uses: { count: 1, reset: "long" },
    });
    expect(spellGrantRecord(chains)).toEqual({ casting: "atWill" });
  });

  it("rules how a feat that records nothing casts its spells", () => {
    const actor = { name: "Actor", source: "PHB" };
    expect(spellGrantRecord(actor)).toEqual({});
    expect(spellGrantRecord(actor, ruling(actor, [{ kind: "spells", casting: "atWill" }]))).toEqual(
      { casting: "atWill" },
    );
  });
});

describe("the casts a race trait records for its known spells", () => {
  const once = { count: 1, reset: "long" };

  it.each([
    ["Hexblood", "VRGR", undefined],
    ["Genasi", "EEPC", { name: "Air", source: "EEPC" }],
    ["Genasi", "EEPC", { name: "Earth", source: "EEPC" }],
    ["Firbolg", "MPMM", undefined],
    ["Genasi", "MPMM", { name: "Earth", source: "MPMM" }],
    ["Dwarf", "PHB", { name: "Mark of Warding", source: "ERLW" }],
    ["Half-Elf", "PHB", { name: "Variant; Mark of Detection", source: "ERLW" }],
    ["Half-Elf", "PHB", { name: "Variant; Mark of Storm", source: "ERLW" }],
    ["Half-Orc", "PHB", { name: "Variant; Mark of Finding", source: "ERLW" }],
    ["Human", "PHB", { name: "Variant; Mark of Finding", source: "ERLW" }],
    ["Halfling", "PHB", { name: "Mark of Healing", source: "ERLW" }],
    ["Halfling", "PHB", { name: "Mark of Hospitality", source: "ERLW" }],
    ["Human", "PHB", { name: "Mark of Making", source: "ERLW" }],
    ["Human", "PHB", { name: "Mark of Passage", source: "ERLW" }],
    ["Human", "PHB", { name: "Mark of Sentinel", source: "ERLW" }],
  ])("counts one cast a long rest for %s %s %o", (name, source, subrace) => {
    expect(raceSpellCasts({ name, source }, subrace)).toEqual(once);
  });

  it("counts none for a race whose spells upstream counts itself", () => {
    expect(raceSpellCasts({ name: "Genasi", source: "EEPC" })).toBeUndefined();
    expect(
      raceSpellCasts({ name: "Genasi", source: "EEPC" }, { name: "Fire", source: "EEPC" }),
    ).toBeUndefined();
  });
});

describe("the spells a dragonmark teaches from 3rd level", () => {
  const marked = (race: string, subrace: string, level: number) =>
    learnedSpells({
      ...definition,
      feats: [],
      optionalFeatures: [],
      race: { name: race, source: "PHB" },
      subrace: { name: subrace, source: "ERLW" },
      levels: Array.from({ length: level }, () => ({ class: { name: "Fighter", source: "PHB" } })),
    });

  it.each([
    ["Dwarf", "Mark of Warding", "Wards and Seals", "arcane lock"],
    ["Half-Elf", "Variant; Mark of Storm", "Headwinds", "gust of wind"],
  ])("teaches the %s %s %s's %s once a long rest, from 3rd level", (race, mark, feature, spell) => {
    expect(marked(race, mark, 2)).toEqual([]);
    expect(marked(race, mark, 3)).toEqual([{ feature, spell, casts: { count: 1, reset: "long" } }]);
  });
});

describe("the spells a feature teaches by name", () => {
  const sorcerer = (level: number, subclass?: ContentRef) =>
    learnedSpells({
      ...definition,
      feats: [],
      optionalFeatures: [],
      levels: Array.from({ length: level }, () => ({
        class: { name: "Sorcerer", source: "PHB" },
        ...(subclass && { subclass }),
      })),
    });

  it("teaches a Lunar Sorcery sorcerer sacred flame from Moon Fire", () => {
    expect(sorcerer(1, { name: "Lunar Sorcery", source: "DSotDQ" })).toEqual([
      { feature: "Moon Fire", spell: "sacred flame" },
    ]);
  });

  it("teaches a sorcerer of another subclass nothing", () => {
    expect(sorcerer(1)).toEqual([]);
  });
});
