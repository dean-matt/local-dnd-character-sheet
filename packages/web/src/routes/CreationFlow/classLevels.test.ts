import { describe, expect, it } from "vitest";
import { rerolled, subclassOf, withClassCount, withSubclass } from "./classLevels.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const WIZARD = { name: "Wizard", source: "PHB" };
const CHAMPION = { name: "Champion", source: "PHB" };
const EVOKER = { name: "School of Evocation", source: "PHB" };

describe("withClassCount", () => {
  it("adds a class after the others, unrolled", () => {
    const levels = [{ class: FIGHTER }, { class: FIGHTER, rolled: 7 }];

    expect(withClassCount(levels, WIZARD, 2)).toEqual([
      { class: FIGHTER },
      { class: FIGHTER, rolled: 7 },
      { class: WIZARD },
      { class: WIZARD },
    ]);
  });

  it("resizes one class in place, keeping each kept level's roll and subclass", () => {
    const levels = [
      { class: FIGHTER },
      { class: FIGHTER, rolled: 7 },
      { class: FIGHTER, rolled: 3, subclass: CHAMPION },
      { class: WIZARD, rolled: 4 },
    ];

    expect(withClassCount(levels, FIGHTER, 4)).toEqual([
      ...levels.slice(0, 3),
      { class: FIGHTER },
      { class: WIZARD, rolled: 4 },
    ]);
    expect(withClassCount(levels, FIGHTER, 2)).toEqual([
      { class: FIGHTER },
      { class: FIGHTER, rolled: 7 },
      { class: WIZARD, rolled: 4 },
    ]);
  });

  it("removes a class at 0, and the next level up takes its die's maximum in place of a roll", () => {
    const levels = [{ class: FIGHTER }, { class: WIZARD, rolled: 4 }, { class: WIZARD, rolled: 2 }];

    expect(withClassCount(levels, FIGHTER, 0)).toEqual([
      { class: WIZARD },
      { class: WIZARD, rolled: 2 },
    ]);
  });

  it("groups each class's levels in the order the classes were first taken", () => {
    const interleaved = [{ class: FIGHTER }, { class: WIZARD }, { class: FIGHTER, rolled: 9 }];

    expect(withClassCount(interleaved, WIZARD, 1)).toEqual([
      { class: FIGHTER },
      { class: FIGHTER, rolled: 9 },
      { class: WIZARD },
    ]);
  });
});

describe("withSubclass", () => {
  const levels = [
    { class: FIGHTER },
    { class: FIGHTER, subclass: CHAMPION },
    { class: FIGHTER },
    { class: WIZARD, subclass: EVOKER },
    { class: WIZARD },
  ];

  it("moves the subclass to the class's level that grants it, leaving another class's be", () => {
    const moved = withSubclass(levels, FIGHTER, CHAMPION, 3);
    expect(moved.map((level) => level.subclass)).toEqual([
      undefined,
      undefined,
      CHAMPION,
      EVOKER,
      undefined,
    ]);
    expect(subclassOf(moved, FIGHTER)).toEqual(CHAMPION);
    expect(subclassOf(moved, WIZARD)).toEqual(EVOKER);
  });

  it("drops the class's subclass where none is given", () => {
    const dropped = withSubclass(levels, WIZARD, undefined, 2);
    expect(subclassOf(dropped, WIZARD)).toBeUndefined();
    expect(subclassOf(dropped, FIGHTER)).toEqual(CHAMPION);
  });
});

describe("rerolled", () => {
  it("rolls every level after the first afresh by its position, or drops every roll", () => {
    const levels = [
      { class: FIGHTER, rolled: 2 },
      { class: FIGHTER, rolled: 3 },
      { class: WIZARD, rolled: 3 },
    ];
    expect(rerolled(levels, (index) => index * 2)).toEqual([
      { class: FIGHTER },
      { class: FIGHTER, rolled: 2 },
      { class: WIZARD, rolled: 4 },
    ]);
    expect(rerolled(levels)).toEqual(levels.map(({ class: cls }) => ({ class: cls })));
  });
});
