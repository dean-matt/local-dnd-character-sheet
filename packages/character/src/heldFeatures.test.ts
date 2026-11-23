import { describe, expect, it } from "vitest";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { heldFeatures } from "./heldFeatures.ts";
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
