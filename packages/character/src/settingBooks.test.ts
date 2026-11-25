import { describe, expect, it } from "vitest";
import { armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import { featInitiativeTerms } from "./featEffects.ts";
import { type DamageSheet, featureDamage } from "./featureAttacks.ts";
import { featureDcs } from "./featureDcs.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { featureRestores } from "./featureRestores.ts";
import { featureRolls } from "./featureRolls.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const character = (of: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  levels: [{ class: { name: "Fighter", source: "PHB" } }],
  ...of,
});

const raceOf = (race: string, source: string, subrace?: [string, string]) =>
  character({
    race: { name: race, source },
    subrace: subrace && { name: subrace[0], source: subrace[1] },
  });

const subclassOf = (className: string, subclass: string, source: string, levels: number) =>
  character({
    levels: Array.from({ length: levels }, (_, index) => ({
      class: { name: className, source: "PHB" },
      ...(index === 0 ? { subclass: { name: subclass, source } } : {}),
    })),
  });

const held = (of: HoldsFeatures) =>
  new Map(heldFeatures(of).map(({ ref, entry }) => [ref.name, entry]));

const usesOf = (of: CharacterDefinition, name: string) =>
  featureLimitedUses(of, (term) => (term === "proficiency" ? 3 : 0))
    .filter(({ feature }) => feature.name === name)
    .map(({ count, reset }) => ({ count, reset }));

const dc = (computed: number) => ({ computed, manual: null, terms: [] });

const stance = {
  armor: "none" as const,
  shield: false,
  meleeWeapons: 0,
  dexterityScore: 14,
  modifierOf: (ability: string) => (ability === "dex" ? 2 : 0),
};

describe("a Path of the Giant barbarian", () => {
  const sheet = (raging: boolean): DamageSheet => ({
    column: () => undefined,
    modifier: () => 0,
    proficiency: 3,
    raging,
  });
  const cleaver = (levels: number, raging: boolean) =>
    featureDamage(
      subclassOf("Barbarian", "Path of the Giant", "BGG", levels),
      { weapon: { kind: "melee", properties: [] }, proficient: true, alone: true },
      sheet(raging),
    ).map(({ source, dice, type }) => ({ source, dice, type }));

  it("offers Elemental Cleaver's die only while raging, two of them from 14th level", () => {
    const type = "acid, cold, fire, thunder or lightning";
    expect(cleaver(6, false)).toEqual([]);
    expect(cleaver(6, true)).toEqual([{ source: "Elemental Cleaver", dice: "1d6", type }]);
    expect(cleaver(14, true)).toEqual([{ source: "Elemental Cleaver", dice: "2d6", type }]);
  });

  it("sets Mighty Impel's DC from Strength", () => {
    const dcs = featureDcs(subclassOf("Barbarian", "Path of the Giant", "BGG", 10), {
      modifier: () => 0,
      ability: (ability) => dc(ability === "str" ? 15 : 10),
      spell: () => undefined,
    });
    expect(dcs).toContainEqual(expect.objectContaining({ label: "Mighty Impel", saveDc: dc(15) }));
  });
});

describe("an Undead warlock", () => {
  it("gains 1d10 plus the warlock level in temporary hit points from Form of Dread", () => {
    const restores = featureRestores(subclassOf("Warlock", "The Undead", "VRGR", 4), {
      column: () => undefined,
      die: () => undefined,
      modifier: () => 0,
      proficiency: 2,
      hitPointMaximum: 30,
    }).filter(({ feature }) => feature.name === "Form of Dread");
    expect(restores).toEqual([expect.objectContaining({ kind: "tempHp", dice: "1d10", bonus: 4 })]);
  });
});

describe("a giant feat", () => {
  it("counts a Strike of the Giants version's uses by the proficiency bonus and offers its die", () => {
    const fire = character({
      feats: [{ ref: { name: "Strike of the Giants; Fire", source: "BGG" } }],
    });
    expect(usesOf(fire, "Strike of the Giants; Fire")).toEqual([{ count: 3, reset: "long" }]);
    const damage = featureDamage(
      fire,
      { weapon: { kind: "melee", properties: [] }, proficient: true, alone: true },
      { column: () => undefined, modifier: () => 0, proficiency: 3, raging: false },
    );
    expect(damage).toEqual([
      expect.objectContaining({ dice: "1d10", type: "fire", offer: expect.anything() }),
    ]);
  });
});

describe("a setting book race", () => {
  it("bases an unarmored lizardfolk's, autognome's, locathah's and Zendikar goblin's Armor Class on Natural Armor", () => {
    const base = (of: CharacterDefinition) => armorClassEffects(of, stance).unarmoredBase?.value;
    expect(base(raceOf("Lizardfolk", "VGM"))).toBe(3);
    expect(base(raceOf("Autognome", "AAG"))).toBe(3);
    expect(base(raceOf("Locathah", "LR"))).toBe(2);
    expect(base(raceOf("Goblin", "PSZ", ["Zendikar; Tuktuk Tribe", "PSZ"]))).toBe(1);
    expect(base(raceOf("Goblin", "PSZ", ["Ixalan", "PSX"]))).toBeUndefined();
  });

  it("adds 4 to a tortle's Armor Class only in its shell", () => {
    const tortle = raceOf("Tortle", "TTP");
    expect(armorClassEffects(tortle, stance).bonus).toEqual([]);
    expect(
      armorClassEffects({ ...tortle, started: new Set(["Shell Defense"]) }, stance).bonus,
    ).toEqual([expect.objectContaining({ label: "Shell Defense", value: 4 })]);
  });

  it("adds the harengon's proficiency bonus to initiative", () => {
    expect(featInitiativeTerms(raceOf("Harengon", "WBtW"), 3)).toEqual([
      expect.objectContaining({ label: "Hare-Trigger", value: 3 }),
    ]);
  });

  it("gives the duergar advantage on saves against poison, illusions, charm and paralysis", () => {
    const sources = featureRolls(
      raceOf("Dwarf", "PHB", ["Duergar", "MTF"]),
      () => 0,
      false,
    ).effects.map(({ source }) => source);
    expect(sources).toContain("Duergar Resilience");
  });

  it("grants the Keldon Strength saves and the Stensia human 2 hit points a level", () => {
    expect(
      held(raceOf("Human", "PHB", ["Keldon", "PSD"])).get("Keldon Resilience")?.mechanics,
    ).toEqual([{ kind: "proficiency", savingThrows: ["str"] }]);
    expect(
      held(raceOf("Human (Innistrad)", "PSI", ["Stensia", "PSI"])).get("Tough")?.mechanics,
    ).toEqual([{ kind: "bonus", target: "hitPointsPerLevel", value: 2 }]);
  });
});

describe("the VRGR lineages", () => {
  const rollsOf = (race: string) =>
    (held(raceOf(race, "VRGR")).get("Deathless Nature")?.mechanics ?? []).map((mechanic) =>
      mechanic.kind === "roll" ? mechanic.roll : mechanic.kind,
    );
  const picksOf = (race: string) =>
    (held(raceOf(race, "VRGR")).get("Ancestral Legacy")?.mechanics ?? []).flatMap((mechanic) =>
      mechanic.kind === "pick" ? [mechanic.count] : [],
    );

  it("gives advantage on saves against disease and poison and on death saves to the reborn alone", () => {
    expect(rollsOf("Reborn")).toEqual(["save", "save", "deathSave"]);
    expect(rollsOf("Dhampir")).toEqual([]);
  });

  it("gives the dhampir and the reborn a pick of two skills, and the hexblood only its row's", () => {
    expect(picksOf("Dhampir")).toEqual([2]);
    expect(picksOf("Reborn")).toEqual([2]);
    expect(picksOf("Hexblood")).toEqual([]);
  });
});
