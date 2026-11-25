import { describe, expect, it } from "vitest";
import { armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import { featInitiativeTerms, speedMatchingWalk, speedWithFeats } from "./featEffects.ts";
import { featureDcs } from "./featureDcs.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { featureRestores } from "./featureRestores.ts";
import { featureRolls } from "./featureRolls.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const raceOf = (race: string, levels = 1, subrace?: string) =>
  ({
    ...definition,
    edition: "classic",
    feats: [],
    optionalFeatures: [],
    race: { name: race, source: "MPMM" },
    subrace: subrace === undefined ? undefined : { name: subrace, source: "MPMM" },
    levels: Array.from({ length: levels }, () => ({ class: { name: "Fighter", source: "PHB" } })),
  }) satisfies CharacterDefinition;

const held = (of: HoldsFeatures) =>
  new Map(heldFeatures(of).map(({ ref, entry }) => [ref.name, entry]));

const restoreSheet = (proficiency: number) => ({
  column: () => undefined,
  die: () => undefined,
  modifier: () => 0,
  proficiency,
  hitPointMaximum: 10,
});

const stance = {
  armor: "none" as const,
  shield: false,
  meleeWeapons: 0,
  dexterityScore: 14,
  modifierOf: (ability: string) => (ability === "dex" ? 2 : 0),
};

describe("a Monsters of the Multiverse race", () => {
  it("heals with as many d4s as the aasimar's proficiency bonus, on another creature", () => {
    const heal = (levels: number) =>
      featureRestores(raceOf("Aasimar; Radiant Soul", levels), restoreSheet(2)).find(
        ({ feature }) => feature.name === "Healing Hands",
      );
    expect(heal(4)).toMatchObject({ kind: "heal", dice: "2d4", others: true });
    expect(heal(5)?.dice).toBe("3d4");
    expect(heal(17)?.dice).toBe("6d4");
  });

  it("gives temporary hit points of twice the proficiency bonus when shifting, 1d6 more for a beasthide", () => {
    const shift = (race: string) =>
      featureRestores(raceOf(race), restoreSheet(2)).filter(({ feature }) =>
        feature.name.startsWith("Shifting"),
      );
    expect(shift("Shifter; Longtooth")).toEqual([
      expect.objectContaining({ kind: "tempHp", dice: null, bonus: 4 }),
    ]);
    expect(shift("Shifter; Beasthide")).toEqual([
      expect.objectContaining({ kind: "tempHp", dice: "1d6", bonus: 4 }),
    ]);
  });

  it("starts the shifted effect of every shifter", () => {
    for (const race of [
      "Shifter",
      "Shifter; Beasthide",
      "Shifter; Longtooth",
      "Shifter; Swiftstride",
      "Shifter; Wildhunt",
    ]) {
      const shifting = [...held(raceOf(race))].find(([name]) => name.startsWith("Shifting"));
      expect(shifting?.[1].mechanics).toContainEqual({ kind: "active" });
    }
  });

  it("counts a trait used as often as the proficiency bonus, and Feline Agility once until the player restores it", () => {
    const uses = (race: string, name: string) =>
      featureLimitedUses(raceOf(race), (term) => (term === "proficiency" ? 3 : 0))
        .filter(({ feature }) => feature.name === name)
        .map(({ count, reset }) => ({ count, reset }));
    expect(uses("Goblin", "Fury of the Small")).toEqual([{ count: 3, reset: "long" }]);
    expect(uses("Kobold; Defiance", "Draconic Cry")).toEqual([{ count: 3, reset: "long" }]);
    expect(uses("Tabaxi", "Feline Agility")).toEqual([{ count: 1, reset: "manual" }]);
  });

  it("adds the harengon's proficiency bonus to initiative", () => {
    expect(featInitiativeTerms(raceOf("Harengon"), 3)).toEqual([
      expect.objectContaining({ label: "Hare-Trigger", value: 3 }),
    ]);
  });

  it("adds 4 to the tortle's Armor Class and advantage on Strength and Constitution saves only in its shell", () => {
    const tortle = raceOf("Tortle");
    const inShell = { ...tortle, started: new Set(["Shell Defense"]) };
    expect(armorClassEffects(tortle, stance).bonus).toEqual([]);
    expect(armorClassEffects(inShell, stance).bonus).toEqual([
      expect.objectContaining({ label: "Shell Defense", value: 4 }),
    ]);
    const saves = (of: HoldsFeatures) =>
      featureRolls(of, () => 0, false).effects.filter(({ source }) => source === "Shell Defense");
    expect(saves(tortle)).toEqual([]);
    expect(saves(inShell).map((effect) => effect.target)).toEqual(["str", "con"]);
  });

  it("flies at the walking speed only while a Radiant Soul aasimar is transformed", () => {
    const aasimar = raceOf("Aasimar; Radiant Soul", 3);
    const flyOf = (of: HoldsFeatures) => {
      const { speed, matches } = speedWithFeats({ walk: 30 }, of, undefined);
      return speedMatchingWalk(speed, matches).speed.fly;
    };
    expect(flyOf(aasimar)).toBeUndefined();
    expect(flyOf({ ...aasimar, started: new Set(["Celestial Revelation (Radiant Soul)"]) })).toBe(
      30,
    );
  });

  it("sets the eladrin's Fey Step DC from its highest of Intelligence, Wisdom and Charisma", () => {
    const dc = (computed: number) => ({ computed, manual: null, terms: [] });
    const dcs = featureDcs(raceOf("Eladrin", 3), {
      modifier: (ability) => (ability === "wis" ? 3 : 1),
      ability: (ability) => dc(ability === "wis" ? 13 : 11),
      spell: () => undefined,
    });
    expect(dcs).toContainEqual(
      expect.objectContaining({ feature: { name: "Fey Step", source: "MPMM" }, saveDc: dc(13) }),
    );
  });

  it("keeps the lizardfolk's and tortle's Natural Armor to their own races", () => {
    const base = (race: string) => armorClassEffects(raceOf(race), stance);
    expect(base("Lizardfolk")).toMatchObject({
      unarmoredBase: { value: 3 },
      unarmoredBaseFixed: false,
    });
    expect(base("Tortle")).toMatchObject({ unarmoredBase: { value: 7 }, unarmoredBaseFixed: true });
    expect(base("Aarakocra").unarmoredBase).toBeUndefined();
  });

  it("leaves a genasi's subrace traits to its subrace", () => {
    const water = held(raceOf("Genasi", 1, "Water"));
    expect(water.get("Call to the Wave")?.mechanics).toEqual([{ kind: "spells" }]);
    expect(water.get("Darkvision")?.narrative).toBe(true);
    expect(water.has("Reach to the Blaze")).toBe(false);
  });
});
