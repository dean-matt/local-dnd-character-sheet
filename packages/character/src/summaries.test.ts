import { describe, expect, it } from "vitest";
import {
  classLevelLabel,
  classLevels,
  classSummary,
  displayName,
  raceSummary,
  totalLevel,
  withExperienceFloor,
} from "./index.ts";
import { definition, elf, FIEND_PATRON, ROGUE, WARLOCK } from "./test/vex.ts";

const names = new Map([
  ["hb_07", "Fireborn"],
  ["hb_08", "Warden"],
]);

describe("homebrew names", () => {
  it("names a homebrew ref from the map, and reads Homebrew for an id it lacks or with none", () => {
    expect(displayName({ homebrewId: "hb_07" }, names)).toBe("Fireborn");
    expect(displayName({ homebrewId: "hb_99" }, names)).toBe("Homebrew");
    expect(displayName({ homebrewId: "hb_07" })).toBe("Homebrew");
  });

  it("names a homebrew race and class in every summary", () => {
    const homebrew = {
      ...elf,
      race: { homebrewId: "hb_07" },
      levels: [{ class: { homebrewId: "hb_08" } }, { class: { homebrewId: "hb_08" } }],
    };
    expect(raceSummary(homebrew, names)).toBe("Fireborn (High)");
    expect(classSummary(homebrew, names)).toBe("Warden");
    expect(classLevelLabel({ class: { homebrewId: "hb_08" }, level: 2 }, names)).toBe("Warden 2");
    expect(classLevelLabel({ class: { homebrewId: "hb_99" }, level: 2 }, names)).toBe("Homebrew 2");
  });

  it("names a homebrew subclass by its current name, and reads Homebrew once it is gone", () => {
    const cleric = { name: "Cleric", source: "PHB" };
    const storm = { class: cleric, level: 1, subclass: { homebrewId: "hb_09" } };
    expect(classLevelLabel(storm, new Map([["hb_09", "Storm Domain"]]))).toBe(
      "Cleric 1 (Storm Domain)",
    );
    expect(classLevelLabel(storm, new Map([["hb_09", "Tempest Domain"]]))).toBe(
      "Cleric 1 (Tempest Domain)",
    );
    expect(classLevelLabel(storm, names)).toBe("Cleric 1 (Homebrew)");
  });
});

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

  it("names a homebrew subrace by its current name, and reads Homebrew once it is gone", () => {
    const moon = { ...elf, subrace: { homebrewId: "hb_10" } };
    expect(raceSummary(moon, new Map([["hb_10", "Moon"]]))).toBe("Elf (Moon)");
    expect(raceSummary(moon, new Map([["hb_10", "Silver"]]))).toBe("Elf (Silver)");
    expect(raceSummary(moon, names)).toBe("Elf (Homebrew)");
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
