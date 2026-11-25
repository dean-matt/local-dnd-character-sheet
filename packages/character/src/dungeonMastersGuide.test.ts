import { describe, expect, it } from "vitest";
import { armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import { featureActionType, featureCost } from "./featureActions.ts";
import { featureDcs } from "./featureDcs.ts";
import { heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const dc = (computed: number) => ({ computed, manual: null, terms: [] });

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
    ...(index === 0 ? { subclass: { name: subclass, source: "DMG" } } : {}),
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

describe("a Death domain cleric", () => {
  it("holds the domain's features at the level that reaches them", () => {
    const first = held(classOf(["Cleric", "PHB"], "Death Domain", 1));
    expect(first.get("Bonus Proficiency")?.mechanics).toEqual([
      { kind: "proficiency", weapons: ["martial"] },
    ]);
    expect(first.get("Death Domain")?.mechanics).toEqual([{ kind: "spells" }]);
    expect(first.get("Reaper")?.mechanics).toEqual([
      { kind: "spells", picks: [{ count: 1, level: 0, from: "any" }] },
    ]);
    expect(held(classOf(["Cleric", "PHB"], "Death Domain", 7)).has("Divine Strike")).toBe(false);
    expect(
      held(classOf(["Cleric", "PHB"], "Death Domain", 8)).get("Divine Strike")?.mechanics,
    ).toMatchObject([{ kind: "extraDamage", dice: "1d8", type: "necrotic" }]);
  });

  it("holds the domain under the 2024 class from level 3", () => {
    const cleric = held(classOf(["Cleric", "XPHB"], "Death Domain", 3));
    expect(cleric.get("Death Domain")?.mechanics).toEqual([{ kind: "spells" }]);
    expect(cleric.get("Channel Divinity: Touch of Death")?.narrative).toBe(true);
  });

  it("spends a Channel Divinity use on Touch of Death", () => {
    expect(featureCost({ name: "Channel Divinity: Touch of Death", source: "DMG" })).toEqual({
      pool: "channel_divinity",
      min: 1,
    });
  });
});

describe("an Oathbreaker paladin", () => {
  it("sets each Channel Divinity option's DC from the paladin spell save DC", () => {
    const sheet = {
      modifier: () => 0,
      ability: () => dc(10),
      spell: (className: string) => (className === "Paladin" ? dc(14) : undefined),
    };
    expect(featureDcs(classOf(["Paladin", "PHB"], "Oathbreaker", 3), sheet)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Control Undead", saveDc: dc(14) }),
        expect.objectContaining({ label: "Dreadful Aspect", saveDc: dc(14) }),
      ]),
    );
    for (const name of ["Control Undead", "Dreadful Aspect"]) {
      expect(featureCost({ name, source: "DMG" })).toEqual({ pool: "channel_divinity", min: 1 });
      expect(featureActionType({ name, source: "DMG" })).toBe("action");
    }
  });

  it("adds Aura of Hate's Charisma to melee damage and limits Dread Lord to a long rest", () => {
    const paladin = held(classOf(["Paladin", "PHB"], "Oathbreaker", 20));
    expect(paladin.get("Aura of Hate")?.mechanics).toEqual([
      { kind: "extraDamage", dice: "cha", weapons: "melee" },
    ]);
    expect(paladin.get("Dread Lord")?.mechanics).toEqual([
      { kind: "active" },
      { kind: "uses", count: 1, reset: "long" },
    ]);
  });
});

describe("a Dungeon Master's Guide race", () => {
  it("gives a goblin Disengage and Hide as bonus actions", () => {
    expect(held(raceOf(["Goblin", "DMG"])).get("Nimble Escape")?.mechanics).toEqual([
      { kind: "turn", bonusAction: ["Disengage", "Hide"] },
    ]);
  });

  it("makes a grimlock immune to being blinded", () => {
    expect(held(raceOf(["Grimlock", "DMG"])).get("Blindsight")?.mechanics).toEqual([
      { kind: "defense", conditionImmune: ["blinded"] },
    ]);
  });

  it("offers a hobgoblin's Martial Advantage once a turn", () => {
    expect(held(raceOf(["Hobgoblin", "DMG"])).get("Martial Advantage")?.mechanics).toMatchObject([
      { kind: "extraDamage", dice: "2d6", oncePerTurn: true },
    ]);
  });

  it("gives an eladrin Fey Step's spell", () => {
    const eladrin = held(raceOf(["Elf", "PHB"], ["Eladrin", "DMG"]));
    expect(eladrin.get("Fey Step")?.mechanics).toEqual([{ kind: "spells" }]);
  });

  it("leaves an orc's darkvision to the race row", () => {
    expect(held(raceOf(["Orc", "DMG"])).get("Darkvision")?.narrative).toBe(true);
  });

  it("adds Natural Armor's +3 to a lizardfolk's Armor Class and its +1 to a troglodyte's", () => {
    const stance = {
      armor: "none" as const,
      shield: false,
      meleeWeapons: 0,
      dexterityScore: 10,
      modifierOf: () => 0,
    };
    const bonus = (race: string) =>
      armorClassEffects(raceOf([race, "DMG"]), stance).bonus.map(({ value }) => value);
    expect(bonus("Lizardfolk")).toEqual([3]);
    expect(bonus("Troglodyte")).toEqual([1]);
  });
});
