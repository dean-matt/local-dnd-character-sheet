import { describe, expect, it } from "vitest";
import { armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import { speedWithFeats } from "./featEffects.ts";
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

  describe("a shifter", () => {
    const SUBRACES = ["Beasthide", "Longtooth", "Swiftstride", "Wildhunt"];
    const shifter = (subrace: string, shifting: boolean) => ({
      ...raceOf(["Shifter", "ERLW"], [subrace, "ERLW"], 5),
      ...(shifting && { started: new Set(["Shifting"]) }),
    });
    const stance = {
      armor: "heavy" as const,
      shield: false,
      meleeWeapons: 0,
      dexterityScore: 10,
      modifierOf: () => 0,
    };
    const benefits = (subrace: string, shifting: boolean) => {
      const of = shifter(subrace, shifting);
      return {
        tempHp: featureRestores(of, sheet)
          .filter(({ kind }) => kind === "tempHp")
          .map(({ dice, bonus }) => ({ dice, bonus })),
        armorClass: armorClassEffects(of, stance).bonus.length,
        walk: speedWithFeats({ walk: 30 }, of, undefined).speed.walk,
        wisdomChecks: featureRolls(of, () => 0, false).effects.filter(
          ({ roll, target }) => roll === "check" && target === "wis",
        ).length,
      };
    };
    type Benefits = {
      tempHp: { dice: string | null; bonus: number }[];
      armorClass: number;
      walk: number;
      wisdomChecks: number;
    };
    const plain: Benefits = {
      tempHp: [{ dice: null, bonus: 7 }],
      armorClass: 0,
      walk: 30,
      wisdomChecks: 0,
    };
    const shifted: Record<string, Benefits> = {
      Beasthide: { ...plain, tempHp: [{ dice: "1d6", bonus: 7 }], armorClass: 1 },
      Longtooth: plain,
      Swiftstride: { ...plain, walk: 40 },
      Wildhunt: { ...plain, wisdomChecks: 1 },
    };

    it.each(SUBRACES)("gives the %s only its own benefit while shifting", (subrace) => {
      expect(benefits(subrace, true)).toEqual(shifted[subrace]);
    });

    it.each(SUBRACES)(
      "gives the %s no benefit beyond the temporary hit points while not shifting",
      (subrace) => {
        const { tempHp, ...rest } = benefits(subrace, false);
        expect(rest).toEqual({ armorClass: 0, walk: 30, wisdomChecks: 0 });
        expect(tempHp).toHaveLength(1);
      },
    );

    it("records Shifting Feature as narrative", () => {
      expect(held(shifter("Wildhunt", false)).get("Shifting Feature")?.narrative).toBe(true);
    });
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
