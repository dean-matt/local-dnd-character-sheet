import { describe, expect, it } from "vitest";
import type { CharacterCatalog } from "./catalog.ts";
import type { CharacterDefinition } from "./definition.ts";
import { speedMatchingWalk, speedWithFeats } from "./featEffects.ts";
import { featGrants } from "./featGrants.ts";
import { featureActionType, featureCostRecorded } from "./featureActions.ts";
import { featureDcs } from "./featureDcs.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const dc = (computed: number) => ({ computed, manual: null, terms: [] });

const sheet = {
  modifier: () => 0,
  ability: (ability: string) => dc(ability === "wis" ? 15 : ability === "con" ? 13 : 10),
  spell: (className: string) => (className === "Ranger" ? dc(14) : undefined),
};

const classOf = (
  [className, classSource]: [string, string],
  subclass: string,
  count: number,
): CharacterDefinition => ({
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: className, source: classSource },
    ...(index === 0 ? { subclass: { name: subclass, source: "FTD" } } : {}),
  })),
});

const dragonborn = (kind: string, level = 5): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  race: { name: `Dragonborn (${kind})`, source: "FTD" },
  subrace: undefined,
  levels: Array.from({ length: level }, () => ({ class: { name: "Fighter", source: "PHB" } })),
});

const immunities = (of: CharacterDefinition & HoldsFeatures, raceResistance?: string) => {
  const catalog = {
    featGrants: new Map(),
    itemSkills: new Map(),
    skills: [],
    raceDefenses: { resistChoice: ["acid", "cold", "fire", "lightning", "poison"] },
  } as unknown as CharacterCatalog;
  return featGrants({ ...of, raceResistance }, catalog).defenses.flatMap(({ immune }) => immune);
};

const flyOf = (of: HoldsFeatures) => {
  const { speed, matches } = speedWithFeats({ walk: 30 }, of, undefined);
  return speedMatchingWalk(speed, matches).speed.fly;
};

const withFeat = (name: string): CharacterDefinition => ({
  ...definition,
  feats: [{ ref: { name, source: "FTD" } }],
  optionalFeatures: [],
  levels: [{ class: { name: "Fighter", source: "PHB" } }],
});

const held = (of: HoldsFeatures) =>
  new Map(heldFeatures(of).map(({ ref, entry }) => [ref.name, entry]));

const usesOf = (of: CharacterDefinition, name: string) =>
  featureLimitedUses(of, (term) => (term === "proficiency" ? 3 : 0))
    .filter(({ feature }) => feature.name === name)
    .map(({ count, reset, part }) => ({ count, reset, part }));

describe("a Way of the Ascendant Dragon monk", () => {
  const monk = classOf(["Monk", "PHB"], "Way of the Ascendant Dragon", 17);

  it("sets Breath of the Dragon and the aura's DCs from the ki save DC", () => {
    const dcs = featureDcs(monk, sheet);
    for (const name of ["Breath of the Dragon", "Aspect of the Wyrm", "Ascendant Aspect"])
      expect(dcs).toContainEqual(
        expect.objectContaining({ feature: { name, source: "FTD" }, label: "Ki", saveDc: dc(15) }),
      );
  });

  it("counts Breath of the Dragon and Wings Unfurled by the proficiency bonus", () => {
    for (const name of ["Breath of the Dragon", "Wings Unfurled"])
      expect(usesOf(monk, name)).toEqual([{ count: 3, reset: "long", part: undefined }]);
  });

  it("flies at its walking speed while the wings are unfurled, and gains blindsight at 17th level", () => {
    expect(flyOf(monk)).toBeUndefined();
    expect(flyOf({ ...monk, started: new Set(["Wings Unfurled"]) })).toBe(30);
    const features = held(monk);
    expect(features.get("Ascendant Aspect")?.mechanics).toContainEqual({
      kind: "sense",
      name: "blindsight",
      range: 10,
    });
    expect(features.get("Draconic Disciple")?.mechanics).toEqual([
      { kind: "pick", fields: ["languages"], count: 1 },
    ]);
  });

  it("leaves each ki cost that restores a use or rides on an option to the player", () => {
    for (const name of ["Breath of the Dragon", "Aspect of the Wyrm", "Ascendant Aspect"])
      expect(featureCostRecorded({ name, source: "FTD" })).toBe(true);
    expect(featureActionType({ name: "Aspect of the Wyrm", source: "FTD" })).toBe("bonus action");
  });
});

describe("a Drakewarden ranger", () => {
  const ranger = classOf(["Ranger", "PHB"], "Drakewarden", 15);

  it("sets Drake's Breath's DC from the ranger spell save DC", () => {
    expect(featureDcs(ranger, sheet)).toContainEqual(
      expect.objectContaining({ label: "Drake's Breath", saveDc: dc(14) }),
    );
    expect(featureActionType({ name: "Drake's Breath", source: "FTD" })).toBe("action");
  });

  it("grants thaumaturgy and a language, and counts Reflexive Resistance by the proficiency bonus", () => {
    expect(held(ranger).get("Draconic Gift")?.mechanics).toEqual([
      { kind: "spells" },
      { kind: "pick", fields: ["languages"], count: 1 },
    ]);
    expect(usesOf(ranger, "Perfected Bond")).toEqual([
      { count: 3, reset: "long", part: undefined },
    ]);
  });
});

describe("a Fizban's dragonborn", () => {
  it("sets the breath weapon's Constitution DC and counts it by the proficiency bonus", () => {
    for (const kind of ["Chromatic; Red", "Gem", "Metallic; Silver"]) {
      expect(featureDcs(dragonborn(kind), sheet)).toContainEqual(
        expect.objectContaining({ label: "Breath Weapon", saveDc: dc(13) }),
      );
      expect(usesOf(dragonborn(kind), "Breath Weapon")).toEqual([
        { count: 3, reset: "long", part: undefined },
      ]);
    }
  });

  it("flies at its walking speed while Gem Flight runs", () => {
    const gem = dragonborn("Gem; Topaz");
    expect(flyOf(gem)).toBeUndefined();
    expect(flyOf({ ...gem, started: new Set(["Gem Flight"]) })).toBe(30);
  });

  it("starts Chromatic Warding and sets the metallic breath's DC", () => {
    expect(held(dragonborn("Chromatic; Black")).get("Chromatic Warding")?.mechanics).toContainEqual(
      {
        kind: "active",
      },
    );
    expect(featureDcs(dragonborn("Metallic; Gold"), sheet)).toContainEqual(
      expect.objectContaining({ label: "Metallic Breath Weapon", saveDc: dc(13) }),
    );
  });

  it("makes each chromatic color immune to its damage type while Chromatic Warding runs", () => {
    const types = { Black: "acid", Blue: "lightning", Green: "poison", Red: "fire", White: "cold" };
    for (const [color, type] of Object.entries(types)) {
      const warded = {
        ...dragonborn(`Chromatic; ${color}`),
        started: new Set(["Chromatic Warding"]),
      };
      expect(immunities(warded)).toEqual([type]);
      expect(immunities(dragonborn(`Chromatic; ${color}`))).toEqual([]);
    }
  });

  it("makes the unspecified chromatic dragonborn immune to the type its race resistance picked", () => {
    const warded = {
      ...dragonborn("Chromatic"),
      started: new Set(["Chromatic Warding"]),
    };
    expect(immunities(warded, "fire")).toEqual(["fire"]);
    expect(immunities(warded, "force")).toEqual([]);
  });

  it("holds Chromatic Warding, Gem Flight and Metallic Breath Weapon from 5th level", () => {
    for (const [kind, name] of [
      ["Chromatic; Red", "Chromatic Warding"],
      ["Gem; Topaz", "Gem Flight"],
      ["Metallic; Gold", "Metallic Breath Weapon"],
    ] as const) {
      expect(held(dragonborn(kind, 4)).has(name)).toBe(false);
      expect(held(dragonborn(kind, 5)).has(name)).toBe(true);
    }
  });

  it("leaves the resistance to the race row", () => {
    expect(held(dragonborn("Chromatic; Blue")).get("Draconic Resistance")?.narrative).toBe(true);
  });
});

describe("a dragon gift feat", () => {
  it("counts Chromatic Infusion apart from Reactive Resistance", () => {
    const feat = withFeat("Gift of the Chromatic Dragon");
    expect(usesOf(feat, "Gift of the Chromatic Dragon")).toEqual([
      { count: 3, reset: "long", part: undefined },
      { count: 1, reset: "long", part: "infusion" },
    ]);
    expect(held(feat).get("Gift of the Chromatic Dragon")?.mechanics).toContainEqual(
      expect.objectContaining({ kind: "extraDamage", dice: "1d4" }),
    );
  });

  it("counts the gem and metallic gifts' reactions by the proficiency bonus", () => {
    for (const name of ["Gift of the Gem Dragon", "Gift of the Metallic Dragon"])
      expect(usesOf(withFeat(name), name)).toEqual([{ count: 3, reset: "long", part: undefined }]);
  });
});
