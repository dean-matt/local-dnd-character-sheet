import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureActionType, featureCost } from "./featureActions.ts";
import { featureDcs } from "./featureDcs.ts";
import { heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const dc = (computed: number) => ({ computed, manual: null, terms: [] });

const cleric = (domain: string, count: number, source = "PHB"): CharacterDefinition => ({
  ...definition,
  edition: source === "XPHB" ? "one" : "classic",
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: "Cleric", source },
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

  it("records Preserve Life's healing and Feat of Strength's bonus", () => {
    expect(held(cleric("Solidarity", 2)).get("Channel Divinity: Preserve Life")?.mechanics).toEqual(
      [{ kind: "heal", bonus: ["level"], times: 5, others: true }],
    );
    expect(
      held(cleric("Strength", 2)).get("Channel Divinity: Feat of Strength")?.mechanics,
    ).toMatchObject([
      { kind: "attack", attack: 10 },
      { kind: "roll", roll: "save", bonus: 10 },
      { kind: "roll", roll: "check", bonus: 10 },
    ]);
  });

  it("holds the same domain and Channel Divinity records on the XPHB Cleric at level 3", () => {
    for (const domain of ["Ambition", "Knowledge", "Solidarity", "Strength", "Zeal"]) {
      const phb = held(cleric(domain, 2));
      const xphb = held(cleric(domain, 3, "XPHB"));
      const marks = (entry?: { mechanics?: unknown; narrative?: boolean }) => ({
        mechanics: entry?.mechanics,
        narrative: entry?.narrative,
      });
      const domainName = `${domain} Domain (PSA)`;
      expect(marks(xphb.get(domainName))).toEqual(marks(phb.get(domainName)));
      expect(xphb.has(domainName)).toBe(true);
      const option =
        { Ambition: "Invoke Duplicity", Knowledge: "", Solidarity: "Preserve Life" }[domain] ??
        (domain === "Strength" ? "Feat of Strength" : "Consuming Fervor");
      const name = `Channel Divinity: ${option}`;
      if (option) expect(marks(xphb.get(name))).toEqual(marks(phb.get(name)));
    }
    expect(
      held(cleric("Strength", 3, "XPHB")).get("Channel Divinity: Feat of Strength"),
    ).toBeDefined();
    expect(held(cleric("Strength", 2, "XPHB")).has("Channel Divinity: Feat of Strength")).toBe(
      false,
    );
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

  it("limits a Minotaur's Relentless Endurance to once per long rest", () => {
    expect(
      held(raceOf(["Minotaur (Amonkhet)", "PSA"])).get("Relentless Endurance")?.mechanics,
    ).toEqual([
      { kind: "heal", bonus: [1] },
      { kind: "uses", count: 1, reset: "long" },
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
