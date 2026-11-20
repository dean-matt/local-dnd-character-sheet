import { describe, expect, it } from "vitest";
import { armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import { speedWithFeats } from "./featEffects.ts";
import { featureStrike } from "./featureAttacks.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { featureMechanicsSchema } from "./featureMechanics.ts";
import { featureRolls } from "./featureRolls.ts";
import { startableFeatures } from "./heldFeatures.ts";
import { effectBlockedBy, effectEnded, effectRunning, effectStarted } from "./ongoingEffects.ts";
import type { Ability } from "./refs.ts";
import { definition } from "./test/vex.ts";

type Holder = CharacterDefinition & { started?: ReadonlySet<string> };

const levelled = (
  [className, classSource]: [string, string],
  count: number,
  subclass: { name: string; source: string },
  started: string[] = [],
): Holder => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: className, source: classSource },
    ...(index === 0 && { subclass }),
  })),
  started: new Set(started),
});

const bladesinger = (started: string[] = []) =>
  levelled(["Wizard", "PHB"], 2, { name: "Bladesinging", source: "TCE" }, started);

const modifiers =
  (scores: Partial<Record<Ability, number>>) =>
  (ability: Ability): number =>
    scores[ability] ?? 0;

const STANCE = {
  armor: "none" as const,
  shield: false,
  meleeWeapons: 0,
  dexterityScore: 14,
  modifierOf: modifiers({ int: 3 }),
};

describe("effectStarted and effectEnded", () => {
  it("adds the effect once and removes it without touching another", () => {
    const calm = { activeEffects: [{ name: "Rage" }] };
    const started = effectStarted(calm, "Bladesong");
    expect(started.activeEffects).toEqual([{ name: "Rage" }, { name: "Bladesong" }]);
    expect(effectStarted(started, "Bladesong")).toBe(started);
    expect(effectRunning(started, "Bladesong")).toBe(true);
    expect(effectEnded(started, "Bladesong")).toEqual(calm);
  });
});

describe("effectBlockedBy", () => {
  const bladesong = ["incapacitated", "medium", "heavy", "shield"] as const;

  it("refuses a start in armor of a category that ends the effect", () => {
    expect(effectBlockedBy(bladesong, ["medium", undefined])).toBe("Medium armor is worn.");
    expect(effectBlockedBy(bladesong, ["light", "shield"])).toBe("A shield is equipped.");
  });

  it("allows a start in other armor, or with no armor that ends it", () => {
    expect(effectBlockedBy(bladesong, ["light", undefined])).toBeNull();
    expect(effectBlockedBy(["incapacitated"], ["heavy", "shield"])).toBeNull();
  });
});

describe("a started feature's mechanics", () => {
  it("lists Bladesong as startable, counting its uses by the proficiency bonus", () => {
    expect(startableFeatures(bladesinger())).toEqual([
      {
        name: "Bladesong",
        source: "TCE",
        endsOn: ["incapacitated", "medium", "heavy", "shield"],
      },
    ]);
    const uses = featureLimitedUses(bladesinger(), (term) => (term === "proficiency" ? 2 : 0));
    expect(uses.find(({ feature }) => feature.name === "Bladesong")?.count).toBe(2);
  });

  it("adds Bladesong's Intelligence to AC, at least +1, only while it runs", () => {
    expect(armorClassEffects(bladesinger(), STANCE).bonus).toEqual([]);
    expect(armorClassEffects(bladesinger(["Bladesong"]), STANCE).bonus).toEqual([
      expect.objectContaining({ label: "Bladesong (Intelligence)", value: 3 }),
    ]);
    const dull = { ...STANCE, modifierOf: modifiers({ int: -1 }) };
    expect(armorClassEffects(bladesinger(["Bladesong"]), dull).bonus[0]?.value).toBe(1);
  });

  it("raises the walk by 10 feet and gives advantage on Acrobatics while Bladesong runs", () => {
    expect(speedWithFeats({ walk: 30 }, bladesinger(), undefined).speed.walk).toBe(30);
    expect(speedWithFeats({ walk: 30 }, bladesinger(["Bladesong"]), undefined).speed.walk).toBe(40);
    expect(featureRolls(bladesinger(), modifiers({ int: 3 }), false).effects).toEqual([]);
    expect(featureRolls(bladesinger(["Bladesong"]), modifiers({ int: 3 }), false).effects).toEqual([
      expect.objectContaining({ source: "Bladesong", mode: "advantage", target: "acrobatics" }),
    ]);
  });

  it("gives Dragon Wings' flying speed only while the wings are out", () => {
    const sorcerer = (started: string[] = []) =>
      levelled(["Sorcerer", "PHB"], 14, { name: "Draconic Bloodline", source: "PHB" }, started);
    const sorcerer24 = (started: string[] = []) =>
      levelled(["Sorcerer", "XPHB"], 14, { name: "Draconic Sorcery", source: "XPHB" }, started);
    expect(speedWithFeats({ walk: 30 }, sorcerer(), undefined).speed.fly).toBeUndefined();
    const winged = speedWithFeats({ walk: 30 }, sorcerer(["Dragon Wings"]), undefined);
    expect(winged.matches).toEqual([expect.objectContaining({ mode: "fly" })]);
    expect(speedWithFeats({ walk: 30 }, sorcerer24(["Dragon Wings"]), undefined).speed.fly).toBe(
      60,
    );
  });

  it("offers Sacred Weapon's Charisma on weapon attacks, at least +1, only while it runs", () => {
    const paladin = (started: string[] = []) =>
      levelled(["Paladin", "PHB"], 3, { name: "Oath of Devotion", source: "PHB" }, started);
    const strike = { weapon: { kind: "melee" as const }, proficient: true, alone: false };
    expect(featureStrike(paladin(), strike, modifiers({ cha: 3 })).options).toEqual([]);
    const running = paladin(["Sacred Weapon"]);
    expect(featureStrike(running, strike, modifiers({})).options).toEqual([
      expect.objectContaining({ source: "Sacred Weapon", attack: 1, damage: 0 }),
    ]);
    expect(
      featureStrike(running, { proficient: true, alone: false }, modifiers({})).options,
    ).toEqual([]);
  });
});

describe("featureMechanicsSchema", () => {
  it("refuses a mechanic held while active on a feature with no effect to start", () => {
    const entry = {
      ref: { name: "Steady", source: "PHB" },
      mechanics: [{ kind: "speed", bonus: 10, while: "active" }],
    };
    expect(featureMechanicsSchema.safeParse(entry).success).toBe(false);
    entry.mechanics.push({ kind: "active" } as never);
    expect(featureMechanicsSchema.safeParse(entry).success).toBe(true);
  });
});
