import type { Ability } from "@dnd/character";
import { describe, expect, it } from "vitest";
import {
  meetsPrerequisite,
  prerequisiteText,
  withPrerequisiteDepartures,
} from "./multiclassPrerequisites.ts";

const scores =
  (set: Partial<Record<Ability, number>>) =>
  (ability: Ability): number =>
    set[ability] ?? 10;

const FIGHTER = { name: "Fighter", firstIndex: 0, prerequisite: [{ str: 13 }, { dex: 13 }] };
const MONK = { name: "Monk", firstIndex: 3, prerequisite: [{ dex: 13, wis: 13 }] };

describe("meetsPrerequisite", () => {
  it("passes on any one alternative met in full, and on an empty list", () => {
    expect(meetsPrerequisite(FIGHTER.prerequisite, scores({ dex: 13 }))).toBe(true);
    expect(meetsPrerequisite(FIGHTER.prerequisite, scores({ str: 12, dex: 12 }))).toBe(false);
    expect(meetsPrerequisite(MONK.prerequisite, scores({ dex: 15 }))).toBe(false);
    expect(meetsPrerequisite([], scores({}))).toBe(true);
  });
});

describe("prerequisiteText", () => {
  it("joins an alternative's minimums with and, the alternatives with or", () => {
    expect(prerequisiteText(FIGHTER.prerequisite)).toBe("Strength 13 or Dexterity 13");
    expect(prerequisiteText(MONK.prerequisite)).toBe("Dexterity 13 and Wisdom 13");
  });
});

describe("withPrerequisiteDepartures", () => {
  const homebrew = { field: "levels", note: "a homebrew class" };

  it("notes every class whose prerequisite the scores miss, the first class included", () => {
    expect(
      withPrerequisiteDepartures([homebrew], [FIGHTER, MONK], scores({ dex: 14, wis: 12 })),
    ).toEqual([
      homebrew,
      {
        field: "levels.3.class",
        note: "Multiclassing in or out of Monk needs Dexterity 13 and Wisdom 13.",
      },
    ]);
    expect(withPrerequisiteDepartures([], [FIGHTER, MONK], scores({}))).toHaveLength(2);
  });

  it("drops every note for one class, for unset scores, and once the scores meet it", () => {
    const stale = withPrerequisiteDepartures([homebrew], [FIGHTER, MONK], scores({}));
    expect(withPrerequisiteDepartures(stale, [FIGHTER], scores({}))).toEqual([homebrew]);
    expect(withPrerequisiteDepartures(stale, [FIGHTER, MONK], undefined)).toEqual([homebrew]);
    expect(
      withPrerequisiteDepartures(stale, [FIGHTER, MONK], scores({ str: 13, dex: 13, wis: 13 })),
    ).toEqual([homebrew]);
  });
});
