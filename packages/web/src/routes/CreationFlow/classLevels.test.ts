import { describe, expect, it } from "vitest";
import { levelsIn, rerolled, subclassOf, withSubclass } from "./classLevels.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const BARBARIAN = { name: "Barbarian", source: "PHB" };
const CHAMPION = { name: "Champion", source: "PHB" };

describe("levelsIn", () => {
  it("keeps each roll at its position but the first's, and adds levels unrolled", () => {
    const previous = [
      { class: FIGHTER, rolled: 4 },
      { class: FIGHTER, rolled: 7 },
    ];

    expect(levelsIn(BARBARIAN, 3, previous)).toEqual([
      { class: BARBARIAN },
      { class: BARBARIAN, rolled: 7 },
      { class: BARBARIAN },
    ]);
  });
});

describe("withSubclass", () => {
  const levels = [{ class: FIGHTER }, { class: FIGHTER, subclass: CHAMPION }, { class: FIGHTER }];

  it("moves the subclass to the level that grants it", () => {
    const moved = withSubclass(levels, CHAMPION, 3);
    expect(moved.map((level) => level.subclass)).toEqual([undefined, undefined, CHAMPION]);
    expect(subclassOf(moved)).toEqual(CHAMPION);
  });

  it("drops it where none is given", () => {
    expect(withSubclass(levels, undefined, 3)).toEqual(levels.map(() => ({ class: FIGHTER })));
  });
});

describe("rerolled", () => {
  it("rolls every level after the first afresh, or drops every roll", () => {
    const levels = [
      { class: FIGHTER, rolled: 2 },
      { class: FIGHTER, rolled: 3 },
    ];
    expect(rerolled(levels, () => 8)).toEqual([{ class: FIGHTER }, { class: FIGHTER, rolled: 8 }]);
    expect(rerolled(levels)).toEqual([{ class: FIGHTER }, { class: FIGHTER }]);
  });
});
