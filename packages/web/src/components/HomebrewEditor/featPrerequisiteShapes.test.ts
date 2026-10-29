import { describe, expect, it } from "vitest";
import {
  hasUnshownParts,
  levelOf,
  prerequisiteProblem,
  proficienciesOf,
  proficiencyEntry,
  racesOf,
  scoresOf,
} from "./featPrerequisiteShapes.ts";

describe("feat prerequisite parts", () => {
  it("reads each part as the form shows it, lowercasing names", () => {
    const parts = {
      level: 4,
      ability: [{ str: 13 }, { dex: 13 }],
      race: [{ name: "Elf" }],
      proficiency: [{ armor: "Heavy" }, { weapon: "martial" }],
    };
    expect(levelOf(parts)).toBe(4);
    expect(scoresOf(parts)).toEqual([
      { ability: "str", minimum: 13 },
      { ability: "dex", minimum: 13 },
    ]);
    expect(racesOf(parts)).toEqual(["elf"]);
    expect(proficienciesOf(parts)).toEqual(["armor:heavy", "weapon:martial"]);
    expect(proficiencyEntry("weapon:martial")).toEqual({ weapon: "martial" });
    expect(hasUnshownParts(parts)).toBe(false);
  });

  it("leaves a class level, a subrace, a weapon group, two scores at once and an unknown key to the JSON", () => {
    expect(levelOf({ level: { level: 4, class: { name: "Fighter" } } })).toBeUndefined();
    expect(racesOf({ race: [{ name: "elf", subrace: "drow" }] })).toBeUndefined();
    expect(proficienciesOf({ proficiency: [{ weaponGroup: "firearms" }] })).toBeUndefined();
    expect(scoresOf({ ability: [{ str: 13, dex: 13 }] })).toBeUndefined();
    expect(hasUnshownParts({ race: [{ name: "elf", subrace: "drow" }] })).toBe(true);
    expect(hasUnshownParts({ level: 4, campaign: ["Eberron"] })).toBe(true);
  });

  it("names an empty alternative, a level outside 1 to 20 and a score minimum outside 1 to 30", () => {
    expect(prerequisiteProblem({}, 2)).toBe("Prerequisite 2: set at least one requirement");
    expect(prerequisiteProblem({ level: 0 }, 1)).toMatch(/level from 1 to 20/);
    expect(prerequisiteProblem({ ability: [{ str: 31 }] }, 1)).toMatch(/from 1 to 30/);
    expect(prerequisiteProblem({ ability: [{ str: null }] }, 1)).toMatch(/from 1 to 30/);
    expect(prerequisiteProblem({ level: 20, ability: [{ str: 30 }] }, 1)).toBeUndefined();
  });
});
