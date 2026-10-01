import { describe, expect, it } from "vitest";
import { classLevels, classSummary, raceLabel, raceSummary, totalLevel } from "./index.ts";
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
  it("summarizes by the subrace's own name, not the race's", () => {
    expect(raceSummary(elf)).toBe("High");
  });

  it("labels the race with the subrace beside it", () => {
    expect(raceLabel(elf)).toBe("Elf (High)");
    expect(raceLabel(definition)).toBe("Half-Elf");
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
