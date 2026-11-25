import { describe, expect, it } from "vitest";
import { armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import { featureRestores } from "./featureRestores.ts";
import { featureRolls } from "./featureRolls.ts";
import { featureTurn } from "./featureTurn.ts";
import { heldFeatures } from "./heldFeatures.ts";
import { definition } from "./test/vex.ts";

const raceOf = (race: [string, string], subrace?: [string, string], levels = 1) =>
  ({
    ...definition,
    edition: "classic",
    feats: [],
    optionalFeatures: [],
    race: { name: race[0], source: race[1] },
    subrace: subrace && { name: subrace[0], source: subrace[1] },
    levels: Array.from({ length: levels }, () => ({ class: { name: "Fighter", source: "PHB" } })),
  }) satisfies CharacterDefinition;

const held = (of: CharacterDefinition) =>
  new Map(heldFeatures(of).map(({ ref, entry }) => [ref.name, entry]));

const sheet = {
  column: () => undefined,
  die: () => undefined,
  modifier: (ability: string) => (ability === "con" ? 2 : 0),
  proficiency: 2,
  hitPointMaximum: 10,
};

describe("an Eberron race", () => {
  it("gives the goblin Disengage and Hide as bonus actions", () => {
    expect(featureTurn(raceOf(["Goblin", "ERLW"]), false).bonusActions).toEqual([
      { action: "Disengage", features: ["Nimble Escape"] },
      { action: "Hide", features: ["Nimble Escape"] },
    ]);
  });

  it("gives the kalashtar advantage on Wisdom saves and the warforged on saves against poison", () => {
    const rolls = (of: CharacterDefinition) => featureRolls(of, () => 0, false).effects;
    expect(rolls(raceOf(["Kalashtar", "ERLW"]))).toContainEqual({
      source: "Dual Mind",
      mode: "advantage",
      roll: "save",
      target: "wis",
    });
    expect(rolls(raceOf(["Warforged", "ERLW"]))).toContainEqual({
      source: "Constructed Resilience",
      mode: "advantage",
      roll: "save",
      condition: "against being poisoned",
    });
  });

  it("adds 1 to the warforged's Armor Class, armored or not", () => {
    const stance = {
      armor: "heavy" as const,
      shield: false,
      meleeWeapons: 0,
      dexterityScore: 10,
      modifierOf: () => 0,
    };
    expect(armorClassEffects(raceOf(["Warforged", "ERLW"]), stance).bonus).toEqual([
      expect.objectContaining({ label: "Integrated Protection", value: 1 }),
    ]);
  });

  it("gives a shifter temporary hit points of its level plus its Constitution modifier", () => {
    const shifter = raceOf(["Shifter", "ERLW"], ["Wildhunt", "ERLW"], 5);
    expect(featureRestores(shifter, sheet)).toContainEqual(
      expect.objectContaining({ kind: "tempHp", dice: null, bonus: 7 }),
    );
    const features = held(shifter);
    expect(features.get("Shifting")?.mechanics).toEqual([
      { kind: "active" },
      { kind: "tempHp", bonus: ["level", "con"] },
    ]);
    expect(features.get("Shifting Feature")?.narrative).toBe(true);
  });

  it("offers the bugbear's surprise damage and leaves its darkvision and Stealth to the race row", () => {
    const bugbear = held(raceOf(["Bugbear", "ERLW"]));
    expect(bugbear.get("Surprise Attack")?.mechanics).toMatchObject([
      { kind: "extraDamage", dice: "2d6" },
    ]);
    for (const name of ["Darkvision", "Sneaky", "Long-Limbed", "Powerful Build"])
      expect(bugbear.get(name)?.narrative).toBe(true);
  });
});

describe("a dragonmark", () => {
  it("records the spells of each mark and leaves its d4 on a check to the player", () => {
    const finding = held(raceOf(["Half-Orc", "PHB"], ["Variant; Mark of Finding", "ERLW"]));
    for (const name of ["Finder's Magic", "Spells of the Mark"])
      expect(finding.get(name)?.mechanics).toEqual([{ kind: "spells" }]);
    expect(finding.get("Hunter's Intuition")?.narrative).toBe(true);
    expect(finding.get("Darkvision")?.narrative).toBe(true);
    const sentinel = held(raceOf(["Human", "PHB"], ["Mark of Sentinel", "ERLW"]));
    expect(sentinel.get("Guardian's Shield")?.mechanics).toEqual([{ kind: "spells" }]);
    expect(sentinel.get("Sentinel's Intuition")?.narrative).toBe(true);
    expect(sentinel.has("Finder's Magic")).toBe(false);
  });
});
