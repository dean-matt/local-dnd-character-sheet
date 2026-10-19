import { describe, expect, it } from "vitest";
import { subclassInitiativeTerms } from "./subclassEffects.ts";
import { definition } from "./test/vex.ts";

const ROGUE_2014 = { name: "Rogue", source: "PHB" };
const SWASHBUCKLER = { name: "Swashbuckler", source: "XGE" };
const RAKISH = { name: "Rakish Audacity", source: "XGE" };

const rogue = (levels: number, subclass?: typeof SWASHBUCKLER) => ({
  ...definition,
  levels: Array.from({ length: levels }, (_, index) => ({
    class: ROGUE_2014,
    ...(subclass && index === 2 ? { subclass } : {}),
  })),
});

const modifierOf = (ability: string) => (ability === "cha" ? 3 : 0);

describe("subclass initiative bonuses stated only in prose", () => {
  it("adds the Charisma modifier from level 3 of a Swashbuckler, citing Rakish Audacity", () => {
    expect(subclassInitiativeTerms(rogue(3, SWASHBUCKLER), modifierOf, 2)).toEqual([
      { label: "Rakish Audacity (Charisma)", value: 3, reference: RAKISH },
    ]);
  });

  it("adds nothing below the feature's level or without the subclass", () => {
    expect(subclassInitiativeTerms(rogue(2, SWASHBUCKLER), modifierOf, 2)).toEqual([]);
    expect(subclassInitiativeTerms(rogue(5), modifierOf, 3)).toEqual([]);
    expect(
      subclassInitiativeTerms(rogue(5, { name: "Thief", source: "PHB" }), modifierOf, 3),
    ).toEqual([]);
  });

  it("adds the proficiency bonus for Aura of the Sentinel", () => {
    const paladin = {
      ...definition,
      levels: Array.from({ length: 7 }, (_, index) => ({
        class: { name: "Paladin", source: "XPHB" },
        ...(index === 2 ? { subclass: { name: "Oath of the Watchers", source: "TCE" } } : {}),
      })),
    };
    expect(subclassInitiativeTerms(paladin, modifierOf, 3)).toMatchObject([{ value: 3 }]);
  });
});
