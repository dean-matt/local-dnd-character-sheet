import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import type { Ability } from "./refs.ts";
import { definition } from "./test/vex.ts";
import { unarmoredDefenseTerm } from "./unarmoredDefense.ts";

const MODIFIERS: Record<Ability, number> = { str: 0, dex: 5, con: 3, int: 0, wis: 3, cha: 2 };
const modifierOf = (ability: Ability) => MODIFIERS[ability];

const levelsOf = (
  className: string,
  source: string,
  count: number,
  subclass?: { name: string; source: string },
): CharacterDefinition => ({
  ...definition,
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: className, source },
    ...(subclass && index === count - 1 ? { subclass } : {}),
  })),
});

describe("unarmoredDefenseTerm", () => {
  it.each(["PHB", "XPHB"])("gives a Monk the Wisdom modifier from level 1 (%s)", (source) => {
    expect(unarmoredDefenseTerm(levelsOf("Monk", source, 1), modifierOf, false)).toEqual({
      label: "Unarmored Defense (Wisdom)",
      value: 3,
    });
  });

  it("removes a Monk's formula with a shield and keeps a Barbarian's", () => {
    expect(unarmoredDefenseTerm(levelsOf("Monk", "XPHB", 1), modifierOf, true)).toBeUndefined();
    expect(unarmoredDefenseTerm(levelsOf("Barbarian", "XPHB", 1), modifierOf, true)).toEqual({
      label: "Unarmored Defense (Constitution)",
      value: 3,
    });
  });

  it("gives a College of Dance bard the Charisma formula at the level it arrives", () => {
    const dance = { name: "College of Dance", source: "XPHB" };
    expect(unarmoredDefenseTerm(levelsOf("Bard", "XPHB", 2), modifierOf, false)).toBeUndefined();
    expect(unarmoredDefenseTerm(levelsOf("Bard", "XPHB", 3, dance), modifierOf, false)?.value).toBe(
      2,
    );
    expect(
      unarmoredDefenseTerm(levelsOf("Bard", "XPHB", 3, dance), modifierOf, true),
    ).toBeUndefined();
  });

  it("gives a Draconic Sorcerer 13 + Dexterity in 2014 and 10 + Dexterity + Charisma in 2024", () => {
    const bloodline = { name: "Draconic Bloodline", source: "PHB" };
    const sorcery = { name: "Draconic Sorcery", source: "XPHB" };
    expect(
      unarmoredDefenseTerm(levelsOf("Sorcerer", "PHB", 1, bloodline), modifierOf, true),
    ).toEqual({
      label: "Draconic Resilience",
      value: 3,
    });
    expect(
      unarmoredDefenseTerm(levelsOf("Sorcerer", "XPHB", 3, sorcery), modifierOf, true),
    ).toEqual({
      label: "Draconic Resilience (Charisma)",
      value: 2,
    });
  });

  it("takes the highest formula across classes, and none that would lower the base", () => {
    const both: CharacterDefinition = {
      ...definition,
      levels: [...levelsOf("Barbarian", "XPHB", 1).levels, ...levelsOf("Monk", "XPHB", 1).levels],
    };
    expect(unarmoredDefenseTerm(both, modifierOf, false)?.value).toBe(3);
    expect(unarmoredDefenseTerm(both, () => -1, false)).toBeUndefined();
  });

  it("skips a homebrew class", () => {
    const homebrew = { ...definition, levels: [{ class: { homebrewId: "hb_monk" } }] };
    expect(unarmoredDefenseTerm(homebrew, modifierOf, false)).toBeUndefined();
  });
});
