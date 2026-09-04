import { describe, expect, it } from "vitest";
import { rollDice } from "./dice.ts";

/** A random source that yields exactly the given die values, for a die of `faces` sides. */
function loaded(faces: number, ...values: number[]): () => number {
  const queue = [...values];
  return () => {
    const value = queue.shift();
    if (value === undefined) throw new Error("loaded die ran out of values");
    return (value - 1) / faces;
  };
}

const values = (roll: { dice: { value: number }[] }) => roll.dice.map((die) => die.value);
const kept = (roll: { dice: { value: number; kept: boolean }[] }) =>
  roll.dice.filter((die) => die.kept).map((die) => die.value);

describe("rollDice", () => {
  it("rolls a single die with no modifier", () => {
    const roll = rollDice("1d20", { random: loaded(20, 14) });
    expect(roll).toEqual({
      total: 14,
      modifier: 0,
      notation: "1d20",
      dice: [{ faces: 20, value: 14, kept: true }],
    });
  });

  it("defaults an omitted count to one", () => {
    const roll = rollDice("d6", { random: loaded(6, 4) });
    expect(roll.total).toBe(4);
    expect(roll.notation).toBe("1d6");
  });

  it("adds a positive modifier", () => {
    const roll = rollDice("2d6+3", { random: loaded(6, 2, 5) });
    expect(roll.total).toBe(10);
    expect(roll.modifier).toBe(3);
  });

  it("subtracts a negative modifier", () => {
    const roll = rollDice("1d8-1", { random: loaded(8, 8) });
    expect(roll.total).toBe(7);
    expect(roll.modifier).toBe(-1);
  });

  it("keeps the highest dice and reports the discarded ones", () => {
    const roll = rollDice("4d6kh3", { random: loaded(6, 1, 5, 3, 6) });
    expect(values(roll)).toEqual([1, 5, 3, 6]);
    expect(kept(roll)).toEqual([5, 3, 6]);
    expect(roll.total).toBe(14);
  });

  it("keeps the lowest die", () => {
    const roll = rollDice("2d20kl1", { random: loaded(20, 17, 4) });
    expect(kept(roll)).toEqual([4]);
    expect(roll.total).toBe(4);
  });

  it("tolerates whitespace around operators and reports canonical notation", () => {
    const roll = rollDice(" 2d6 + 3 ", { random: loaded(6, 1, 1) });
    expect(roll.total).toBe(5);
    expect(roll.notation).toBe("2d6+3");
  });

  it.each(["1d6 4", "1d2 0", "1 2d6"])("rejects %o rather than reading it as a bigger die", (n) => {
    expect(() => rollDice(n)).toThrow(SyntaxError);
  });

  it("rolls twice and keeps the higher on advantage", () => {
    const roll = rollDice("1d20+5", { mode: "advantage", random: loaded(20, 8, 19) });
    expect(values(roll)).toEqual([8, 19]);
    expect(kept(roll)).toEqual([19]);
    expect(roll.total).toBe(24);
  });

  it("rolls twice and keeps the lower on disadvantage", () => {
    const roll = rollDice("1d20", { mode: "disadvantage", random: loaded(20, 8, 19) });
    expect(kept(roll)).toEqual([8]);
    expect(roll.total).toBe(8);
  });

  it.each(["4d6kh3", "2d6", "1d20kh1"])("rejects advantage on %s", (notation) => {
    expect(() => rollDice(notation, { mode: "advantage" })).toThrow(TypeError);
    expect(() => rollDice(notation, { mode: "advantage" })).toThrow(`"${notation}"`);
  });

  it.each(["", "d", "20", "1d", "1d20kh", "1d20k2", "2d6+", "1d20 or bust", "-1d6"])(
    "rejects %o with the input in the message",
    (notation) => {
      expect(() => rollDice(notation)).toThrow(`"${notation}"`);
    },
  );

  it.each([
    "0d6",
    "1001d6",
    "1d0",
    "1d1001",
    "2d6kh3",
    "1d6+1001",
    "1d6-1001",
    `1d6+${"9".repeat(400)}`,
  ])("rejects %s out of range", (notation) => {
    expect(() => rollDice(notation)).toThrow(RangeError);
  });

  it("stays within the die's faces over many rolls", () => {
    const roll = rollDice("100d6");
    expect(roll.dice.every((die) => die.value >= 1 && die.value <= 6)).toBe(true);
  });
});
