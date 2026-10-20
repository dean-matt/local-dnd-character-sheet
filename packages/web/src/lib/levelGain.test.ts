import type { CharacterDefinition } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../test/records.ts";
import { typedGain, withLevelGain } from "./levelGain.ts";

const warlock = { name: "Warlock", source: "XPHB" };

function definition(...levels: object[]): CharacterDefinition {
  const base = characterRecord("1", "Vex").definition;
  return { ...base, levels: levels.map((level) => ({ class: warlock, ...level })) };
}

describe("withLevelGain", () => {
  const held = definition({}, { rolled: 3 }, { rolled: 9, typed: true });

  it("stores a roll without the typed mark", () => {
    const { levels } = withLevelGain(held, 2, { kind: "roll", face: 6 }, [8, 8, 8]);
    expect(levels[2]).toEqual({ class: warlock, rolled: 6 });
  });

  it("marks a typed gain, past the die or not, and notes the one past it", () => {
    const next = withLevelGain(held, 1, { kind: "typed", gain: 12 }, [8, 8, 8]);
    expect(next.levels[1]).toEqual({ class: warlock, rolled: 12, typed: true });
    expect(next.departures.map((each) => each.field)).toEqual([
      "levels.1.rolled",
      "levels.2.rolled",
    ]);
  });

  it("clears the gain and its mark for the average, and drops the note once it is within the die", () => {
    const noted = withLevelGain(held, 2, { kind: "typed", gain: 12 }, [8, 8, 8]);
    const next = withLevelGain(noted, 2, { kind: "average" }, [8, 8, 8]);
    expect(next.levels[2]).toEqual({ class: warlock });
    expect(next.departures).toEqual([]);
  });

  it("leaves the first level, and a definition whose levels moved, alone", () => {
    expect(withLevelGain(held, 0, { kind: "roll", face: 2 }, [8, 8, 8])).toBe(held);
    expect(withLevelGain(held, 1, { kind: "roll", face: 2 }, [8, 8])).toBe(held);
  });
});

describe("typedGain", () => {
  it.each([
    ["7", 7],
    [" 12 ", 12],
    ["999", 999],
  ])("accepts %j", (text, gain) => expect(typedGain(text)).toBe(gain));

  it.each(["", "0", "-3", "1.5", "1e2", "abc", "1000"])("refuses %j", (text) =>
    expect(typedGain(text)).toBeUndefined(),
  );
});
