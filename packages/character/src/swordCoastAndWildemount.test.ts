import { describe, expect, it } from "vitest";
import { armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import { featureCost } from "./featureActions.ts";
import { featureDamage } from "./featureAttacks.ts";
import { featureDcs } from "./featureDcs.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { definition } from "./test/vex.ts";

const character = (of: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  featureChoices: [],
  ...of,
});

const leveled = (
  [className, classSource]: [string, string],
  subclass: string | undefined,
  source: string,
  levels: number,
) =>
  character({
    levels: Array.from({ length: levels }, (_, index) => ({
      class: { name: className, source: classSource },
      ...(index === 0 && subclass ? { subclass: { name: subclass, source } } : {}),
    })),
  });

const MYSTIC: [string, string] = ["Mystic", "UATheMysticClass"];

const modifiers =
  (of: Record<string, number>) =>
  (term: string): number =>
    of[term] ?? 0;

const usesOf = (of: CharacterDefinition, name: string, modifier = modifiers({})) =>
  featureLimitedUses(of, modifier)
    .filter(({ feature }) => feature.name === name)
    .map(({ count }) => count);

const dc = (computed: number) => ({ computed, manual: null, terms: [] });

describe("a Totem Warrior's SCAG totem", () => {
  const attunement = {
    name: "Totemic Attunement",
    source: "PHB",
    className: "Barbarian",
    classSource: "PHB",
    subclass: { shortName: "Totem Warrior", source: "PHB" },
    level: 14,
  };
  const barbarian = (totem?: string) => ({
    ...leveled(["Barbarian", "PHB"], "Path of the Totem Warrior", "PHB", 14),
    featureChoices: totem
      ? [{ feature: attunement, options: [{ name: totem, source: "SCAG" }] }]
      : [],
  });
  const labels = (of: CharacterDefinition) =>
    featureDcs(of, {
      modifier: () => 0,
      ability: (ability) => dc(ability === "str" ? 16 : 10),
      spell: () => undefined,
    }).map(({ label }) => label);

  it("sets the elk's Strength DC only where Totemic Attunement gave the elk", () => {
    expect(labels(barbarian("Elk"))).toContain("Elk");
    expect(labels(barbarian("Tiger"))).not.toContain("Elk");
    expect(labels(barbarian())).not.toContain("Elk");
  });
});

describe("a Mystic", () => {
  it("adds Potent Psionics' psychic die to a weapon hit, two of them from 14th level", () => {
    const dice = (levels: number) =>
      featureDamage(
        leveled(MYSTIC, undefined, "", levels),
        { weapon: { kind: "melee", properties: [] }, proficient: true, alone: true },
        { column: () => undefined, modifier: () => 0, proficiency: 3, raging: false },
      ).map(({ dice, type }) => ({ dice, type }));
    expect(dice(7)).toEqual([]);
    expect(dice(8)).toEqual([{ dice: "1d8", type: "psychic" }]);
    expect(dice(14)).toEqual([{ dice: "2d8", type: "psychic" }]);
  });

  it("uses Psionic Mastery once a day at 11th level and four times at 17th", () => {
    const uses = (levels: number) =>
      usesOf(leveled(MYSTIC, undefined, "", levels), "Psionic Mastery (1/Day)");
    expect(uses(11)).toEqual([1]);
    expect(uses(15)).toEqual([3]);
    expect(uses(17)).toEqual([4]);
  });

  it("bases an unarmored Immortal's Armor Class on Constitution, which a shield ends", () => {
    const immortal = leveled(MYSTIC, "Order of the Immortal", "UATheMysticClass", 1);
    const stance = (shield: boolean) => ({
      armor: "none" as const,
      shield,
      meleeWeapons: 0,
      dexterityScore: 14,
      modifierOf: (ability: string) => (ability === "con" ? 3 : 2),
    });
    expect(armorClassEffects(immortal, stance(false)).unarmoredBase?.value).toBe(3);
    expect(armorClassEffects(immortal, stance(true)).unarmoredBase).toBeUndefined();
  });

  it("spends psi points on Immortal Will and Hone the Blade", () => {
    expect(featureCost({ name: "Immortal Will", source: "UATheMysticClass" })).toEqual({
      pool: "psi_points",
      min: 5,
    });
    expect(featureCost({ name: "Hone the Blade", source: "UATheMysticClass" })).toEqual({
      pool: "psi_points",
      min: 2,
      max: 7,
    });
  });
});

describe("an Echo Knight", () => {
  it("counts Unleash Incarnation's uses by the Constitution modifier", () => {
    const knight = leveled(["Fighter", "PHB"], "Echo Knight", "EGW", 3);
    expect(usesOf(knight, "Unleash Incarnation", modifiers({ con: 3 }))).toEqual([3]);
  });
});

describe("a SCAG or EGW subclass", () => {
  it("spends Channel Divinity on the Crown's and the Arcana domain's options, and ki on the Long Death's", () => {
    for (const name of [
      "Champion Challenge",
      "Turn the Tide",
      "Channel Divinity: Arcane Abjuration",
    ])
      expect(featureCost({ name, source: "SCAG" })).toEqual({ pool: "channel_divinity", min: 1 });
    expect(featureCost({ name: "Touch of the Long Death", source: "SCAG" })).toEqual({
      pool: "ki_points",
      min: 1,
      max: 10,
    });
  });

  it("sets Momentary Stasis's DC from the wizard's spell save DC", () => {
    const dcs = featureDcs(leveled(["Wizard", "PHB"], "Chronurgy Magic", "EGW", 6), {
      modifier: () => 0,
      ability: () => dc(10),
      spell: (className) => (className === "Wizard" ? dc(15) : undefined),
    });
    expect(dcs).toContainEqual(
      expect.objectContaining({ label: "Momentary Stasis", saveDc: dc(15) }),
    );
  });
});

describe("an EGW dragonborn", () => {
  const draconblood = character({
    race: { name: "Dragonborn", source: "PHB" },
    subrace: { name: "Dragonborn (Draconblood; Black)", source: "EGW" },
  });

  it("breathes once a short rest at a Constitution DC", () => {
    expect(usesOf(draconblood, "Breath Weapon")).toEqual([1]);
    const dcs = featureDcs(draconblood, {
      modifier: () => 0,
      ability: (ability) => dc(ability === "con" ? 13 : 10),
      spell: () => undefined,
    });
    expect(dcs).toContainEqual(expect.objectContaining({ label: "Breath Weapon", saveDc: dc(13) }));
  });
});
