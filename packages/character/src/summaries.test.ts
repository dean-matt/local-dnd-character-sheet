import { describe, expect, it } from "vitest";
import {
  classLevels,
  classSummary,
  raceSummary,
  totalLevel,
  withExperienceFloor,
} from "./index.ts";
import { definition, elf, FIEND_PATRON, ROGUE, WARLOCK } from "./test/vex.ts";

describe("race", () => {
  it("summarizes a race with no subrace by the race's own name", () => {
    expect(raceSummary(definition)).toBe("Half-Elf");
  });

  it("shows a homebrew race as Homebrew, with no catalog to resolve its name", () => {
    expect(raceSummary({ ...definition, race: { homebrewId: "hb_07" } })).toBe("Homebrew");
  });
});

describe("subrace", () => {
  it("summarizes the race with the subrace beside it", () => {
    expect(raceSummary(elf)).toBe("Elf (High)");
  });

  it("shows a homebrew race as Homebrew beside its subrace", () => {
    expect(raceSummary({ ...elf, race: { homebrewId: "hb_07" } })).toBe("Homebrew (High)");
  });
});

describe("class levels", () => {
  it("counts a multiclass character", () => {
    expect(totalLevel(definition)).toBe(5);
  });

  it("summarizes a multiclass character with a count per class, in the order each was first taken", () => {
    expect(classSummary(definition)).toBe("Warlock 3 / Rogue 2");
  });

  it("groups levels by class and names the subclass whichever level chose it", () => {
    expect(classLevels(definition)).toEqual([
      { class: WARLOCK, level: 3, subclass: FIEND_PATRON },
      { class: ROGUE, level: 2 },
    ]);
  });

  it("summarizes a single class with no count", () => {
    expect(classSummary({ ...definition, levels: [{ class: ROGUE }] })).toBe("Rogue");
  });

  it("shows a homebrew class as Homebrew, with no catalog to resolve its name", () => {
    const homebrew = { ...definition, levels: [{ class: { homebrewId: "hb_08" } }] };
    expect(classSummary(homebrew)).toBe("Homebrew");
  });
});

describe("experience floor", () => {
  it("raises a total below the level's threshold to it", () => {
    expect(withExperienceFloor({ ...definition, experience: 0 }).experience).toBe(6500);
  });

  it("leaves a total at or above the threshold alone", () => {
    expect(withExperienceFloor({ ...definition, experience: 7000 }).experience).toBe(7000);
  });

  it("leaves a level 1 character at 0", () => {
    const first = { ...definition, levels: definition.levels.slice(0, 1), experience: 0 };
    expect(withExperienceFloor(first).experience).toBe(0);
  });

  it("leaves a milestone character's stored total alone", () => {
    const milestone = { ...definition, leveling: "milestone" as const, experience: 0 };
    expect(withExperienceFloor(milestone).experience).toBe(0);
  });
});
