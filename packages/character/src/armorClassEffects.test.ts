import { describe, expect, it } from "vitest";
import { type ArmorStance, armorClassEffects } from "./armorClassEffects.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { Ability } from "./refs.ts";
import { definition } from "./test/vex.ts";

const MODIFIERS: Record<Ability, number> = { str: 0, dex: 5, con: 3, int: 0, wis: 3, cha: 2 };

const levelsOf = (
  className: string,
  source: string,
  count: number,
  subclass?: { name: string; source: string },
): CharacterDefinition => ({
  ...definition,
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: className, source },
    ...(subclass && index === count - 1 ? { subclass } : {}),
  })),
});

const unarmored = (
  character: Pick<
    CharacterDefinition,
    "feats" | "optionalFeatures" | "race" | "subrace" | "levels"
  >,
  stance: Partial<ArmorStance> = {},
) =>
  armorClassEffects(character, {
    armor: "none",
    shield: false,
    meleeWeapons: 0,
    dexterityScore: 20,
    modifierOf: (ability) => MODIFIERS[ability],
    ...stance,
  }).unarmoredBase;

describe("the unarmored base", () => {
  it.each(["PHB", "XPHB"])("gives a Monk the Wisdom modifier from level 1 (%s)", (source) => {
    expect(unarmored(levelsOf("Monk", source, 1))).toEqual({
      label: "Unarmored Defense (Wisdom)",
      value: 3,
      reference: { name: "Unarmored Defense", source },
    });
  });

  it("ends a Monk's base with a shield and keeps a Barbarian's", () => {
    expect(unarmored(levelsOf("Monk", "XPHB", 1), { shield: true })).toBeUndefined();
    expect(unarmored(levelsOf("Barbarian", "XPHB", 1), { shield: true })).toMatchObject({
      label: "Unarmored Defense (Constitution)",
      value: 3,
    });
  });

  it("gives a College of Dance bard the Charisma base at the level it arrives", () => {
    const dance = { name: "College of Dance", source: "XPHB" };
    expect(unarmored(levelsOf("Bard", "XPHB", 2))).toBeUndefined();
    expect(unarmored(levelsOf("Bard", "XPHB", 3, dance))?.value).toBe(2);
    expect(unarmored(levelsOf("Bard", "XPHB", 3, dance), { shield: true })).toBeUndefined();
  });

  it("gives a Draconic Sorcerer 13 + Dexterity in 2014 and 10 + Dexterity + Charisma in 2024", () => {
    const bloodline = { name: "Draconic Bloodline", source: "PHB" };
    const sorcery = { name: "Draconic Sorcery", source: "XPHB" };
    expect(unarmored(levelsOf("Sorcerer", "PHB", 1, bloodline), { shield: true })).toMatchObject({
      label: "Draconic Resilience",
      value: 3,
    });
    expect(unarmored(levelsOf("Sorcerer", "XPHB", 2, sorcery))).toBeUndefined();
    expect(unarmored(levelsOf("Sorcerer", "XPHB", 3, sorcery), { shield: true })).toMatchObject({
      label: "Draconic Resilience (Charisma)",
      value: 2,
    });
  });

  it("takes the highest base across classes, and none that would lower the plain 10", () => {
    const both: CharacterDefinition = {
      ...definition,
      feats: [],
      optionalFeatures: [],
      levels: [...levelsOf("Barbarian", "XPHB", 1).levels, ...levelsOf("Monk", "XPHB", 1).levels],
    };
    expect(unarmored(both)?.value).toBe(3);
    expect(unarmored(both, { modifierOf: () => -1 })).toBeUndefined();
  });

  it("skips a homebrew class", () => {
    expect(unarmored({ ...definition, levels: [{ class: { homebrewId: "hb_monk" } }] })).toBe(
      undefined,
    );
  });
});
