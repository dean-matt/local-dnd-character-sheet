import { describe, expect, it } from "vitest";
import { rollDice } from "./index.ts";

/** A random source that yields exactly the given die values, for a die of `faces` sides. */
function loaded(faces: number, ...values: number[]): () => number {
  const queue = [...values];
  return () => {
    const value = queue.shift();
    if (value === undefined) throw new Error("loaded die ran out of values");
    return (value - 1) / faces;
  };
}

/** A random source that yields the given `[faces, value]` pairs, for mixed dice. */
function loadedMixed(...rolls: [number, number][]): () => number {
  const queue = [...rolls];
  return () => {
    const roll = queue.shift();
    if (roll === undefined) throw new Error("loaded die ran out of values");
    const [faces, value] = roll;
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
      dice: [{ faces: 20, value: 14, kept: true, sign: 1 }],
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

  it("reads a run of spaces as one", () => {
    const roll = rollDice("2d6   +   3", { random: loaded(6, 1, 1) });
    expect(roll.total).toBe(5);
    expect(roll.notation).toBe("2d6+3");
  });

  it.each(["1d6    4", "1d6 4", "1d2 0", "1 2d6"])(
    "rejects %o rather than reading it as a bigger die",
    (n) => {
      expect(() => rollDice(n)).toThrow(SyntaxError);
    },
  );

  it("takes advantage on a clause that keeps the only die", () => {
    const roll = rollDice("1d20kh1", { mode: "advantage", random: loaded(20, 8, 19) });
    expect(kept(roll)).toEqual([19]);
  });

  it.each(["1d", "3d", "20d"])("reports %o as malformed, not as a leading constant", (n) => {
    expect(() => rollDice(n)).toThrow(/Invalid dice notation/);
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

  it.each(["4d6kh3", "2d6", "2d20kh1", "1d20+1d4"])("rejects advantage on %s", (notation) => {
    expect(() => rollDice(notation, { mode: "advantage" })).toThrow(TypeError);
    expect(() => rollDice(notation, { mode: "advantage" })).toThrow(`"${notation}"`);
  });

  it.each(["", "d", "20", "1d", "1d20kh", "1d20k2", "2d6+", "1d20 or bust", "-1d6", "3+1d6"])(
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
    "4d6dl4",
    "4d6d4",
    "1d6+10000000000000000000-9999999999999999999",
    "1000d6+1d6",
    `1d6+${"9".repeat(400)}`,
    `1d6+${"9".repeat(400)}-${"9".repeat(400)}`,
  ])("rejects %s out of range", (notation) => {
    expect(() => rollDice(notation)).toThrow(RangeError);
  });

  it("sums several terms and reports every die in roll order", () => {
    const roll = rollDice("1d8+1d6+3", { random: loadedMixed([8, 5], [6, 2]) });
    expect(roll.dice).toEqual([
      { faces: 8, value: 5, kept: true, sign: 1 },
      { faces: 6, value: 2, kept: true, sign: 1 },
    ]);
    expect(roll.modifier).toBe(3);
    expect(roll.total).toBe(10);
  });

  it("subtracts a term's dice from the total and signs them", () => {
    const roll = rollDice("2d6-1d4", { random: loadedMixed([6, 4], [6, 3], [4, 2]) });
    expect(roll.dice.map((die) => die.sign)).toEqual([1, 1, -1]);
    expect(roll.modifier).toBe(0);
    expect(roll.total).toBe(5);
  });

  it("collects scattered constants into one modifier", () => {
    const roll = rollDice("1d2-2+2d3+5", { random: loadedMixed([2, 1], [3, 3], [3, 1]) });
    expect(roll.modifier).toBe(3);
    expect(roll.total).toBe(8);
    expect(roll.notation).toBe("1d2+2d3+3");
  });

  it("keeps a clause to its own term", () => {
    const roll = rollDice("4d6kh3+1d4", {
      random: loadedMixed([6, 1], [6, 5], [6, 3], [6, 6], [4, 2]),
    });
    expect(kept(roll)).toEqual([5, 3, 6, 2]);
    expect(roll.total).toBe(16);
  });

  it.each([
    ["4d6dl1", [5, 3, 6]],
    ["4d6d1", [5, 3, 6]],
    ["4d6dh1", [1, 5, 3]],
  ])("reads %s as the keep clause it inverts", (notation, expected) => {
    const roll = rollDice(notation, { random: loaded(6, 1, 5, 3, 6) });
    expect(values(roll)).toEqual([1, 5, 3, 6]);
    expect(kept(roll)).toEqual(expected);
  });

  it("rolls a drop clause and its keep spelling alike", () => {
    const drop = rollDice("4d6dl1", { random: loaded(6, 1, 5, 3, 6) });
    const keep = rollDice("4d6kh3", { random: loaded(6, 1, 5, 3, 6) });
    expect(drop).toEqual(keep);
  });

  it.each([
    ["1d8+1d6+3", "1d8+1d6+3"],
    ["2d6-1d4", "2d6-1d4"],
    ["2d8 + 1d6", "2d8+1d6"],
    ["1d2-2+2d3+5", "1d2+2d3+3"],
    ["4d6dl1", "4d6kh3"],
    ["4d6d1", "4d6kh3"],
    ["4D6DH1", "4d6kl3"],
    ["4d6d0", "4d6"],
    ["4d6kh4", "4d6"],
  ])("canonicalizes %s to %s and round-trips it", (notation, canonical) => {
    expect(rollDice(notation).notation).toBe(canonical);
    expect(rollDice(canonical).notation).toBe(canonical);
  });

  it("stays within the die's faces over many rolls", () => {
    const roll = rollDice("100d6");
    expect(roll.dice.every((die) => die.value >= 1 && die.value <= 6)).toBe(true);
  });
});
