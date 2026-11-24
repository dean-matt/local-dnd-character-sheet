import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import type { Mechanic } from "./featureMechanics.ts";
import {
  featurePickOffers,
  featureSpellPickOffers,
  heldFeatures,
  spellGrantRecord,
} from "./heldFeatures.ts";
import { refKey } from "./keys.ts";
import type { ContentRef } from "./refs.ts";
import { definition } from "./test/vex.ts";

const raceTraits = FEATURE_MECHANICS.flatMap(({ ref, races }) =>
  (races ?? []).map((owner) => [ref.name, owner] as const),
);

const heldBy = (owner: string) => {
  const [race, raceSource, subrace, subraceSource] = owner.split("|");
  return heldFeatures({
    ...definition,
    feats: [],
    optionalFeatures: [],
    race: { name: race ?? "", source: raceSource ?? "" },
    subrace: subrace && subraceSource ? { name: subrace, source: subraceSource } : undefined,
    levels: [{ class: { name: "Fighter", source: "PHB" } }],
  }).filter(({ origin }) => origin === "race");
};

describe("a racial trait", () => {
  it("is held, as a race trait, by every race that records it", () => {
    expect(raceTraits.length).toBeGreaterThanOrEqual(5);
    for (const [name, owner] of raceTraits)
      expect(heldBy(owner).map(({ ref }) => ref.name)).toContain(name);
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
