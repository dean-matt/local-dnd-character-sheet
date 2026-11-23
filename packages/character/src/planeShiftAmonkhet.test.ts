import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureActionType, featureCost } from "./featureActions.ts";
import { featureDcs } from "./featureDcs.ts";
import { heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const dc = (computed: number) => ({ computed, manual: null, terms: [] });

const cleric = (domain: string, count: number): CharacterDefinition => ({
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: "Cleric", source: "PHB" },
    ...(index === 0 ? { subclass: { name: `${domain} Domain (PSA)`, source: "PSA" } } : {}),
  })),
});

const raceOf = (race: [string, string], subrace?: [string, string]): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  race: { name: race[0], source: race[1] },
  subrace: subrace && { name: subrace[0], source: subrace[1] },
  levels: [{ class: { name: "Fighter", source: "PHB" } }],
});

const held = (of: CharacterDefinition) =>
  new Map(heldFeatures(of).map(({ ref, entry }) => [ref.name, entry]));

describe("a Plane Shift: Amonkhet cleric", () => {
  it("holds each domain's features at the level that reaches them", () => {
    expect([...held(cleric("Zeal", 1)).keys()]).toEqual(
      expect.arrayContaining(["Zeal Domain (PSA)", "Bonus Proficiencies", "Priest of Zeal"]),
    );
    expect(held(cleric("Zeal", 7)).has("Divine Strike")).toBe(false);
    expect(held(cleric("Zeal", 8)).get("Divine Strike")?.mechanics).toMatchObject([
      {
        kind: "extraDamage",
        dice: "1d8",
        scales: [{ level: 14, dice: "2d8" }],
      },
    ]);
    expect(held(cleric("Ambition", 2)).get("Warding Flare")?.mechanics).toEqual([
      { kind: "uses", count: "wis", reset: "long" },
    ]);
  });

  it("spends a Channel Divinity use on each domain's option", () => {
    for (const name of [
      "Channel Divinity: Cloak of Shadows",
      "Channel Divinity: Consuming Fervor",
      "Channel Divinity: Feat of Strength",
      "Channel Divinity: Invoke Duplicity",
      "Channel Divinity: Preserve Life",
    ])
      expect(featureCost({ name, source: "PSA" })).toEqual({
        pool: "channel_divinity",
        min: 1,
      });
    expect(
      featureActionType({
        name: "Channel Divinity: Preserve Life",
        source: "PSA",
      }),
    ).toBe("action");
  });
});

describe("a Plane Shift: Amonkhet race", () => {
  it("gives a Naga its bite's save DC", () => {
    const naga = raceOf(["Naga", "PSA"]);
    const sheet = {
      modifier: () => 1,
      ability: () => dc(12),
      spell: () => undefined,
    };
    expect(featureDcs(naga, sheet)).toMatchObject([
      { feature: { name: "Natural Weapons" }, label: "Bite", saveDc: dc(12) },
    ]);
  });

  it("gives an ibis-headed aven the traits of the aven and of its kind", () => {
    const traits = held(raceOf(["Aven", "PSA"], ["Ibis-Headed", "PSA"]));
    expect(traits.get("Kefnet's Blessing")?.mechanics).toEqual([
      { kind: "halfProficiency", abilities: ["int"], rounding: "down" },
    ]);
    expect(traits.has("Flight")).toBe(true);
    expect(traits.has("Hawkeyed")).toBe(false);
  });
});
