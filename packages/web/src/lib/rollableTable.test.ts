import { describe, expect, it } from "vitest";
import { rowFor, rowRange, tableDie } from "./rollableTable.ts";

describe("tableDie", () => {
  it.each([
    ["d100", "d100"],
    ["2d4", "2d4"],
    ["{@dice d6}", "d6"],
    [" {@dice 1d8|🎲} ", "1d8"],
  ])("reads %s as %s", (label, die) => expect(tableDie(label)).toBe(die));

  it.each(["Wyrmling d8", "d6 + Level", "{@dice d20 + 2}", "Effect", "d0", 6, undefined])(
    "names no die for %s",
    (label) => expect(tableDie(label)).toBeUndefined(),
  );
});

describe("rowRange", () => {
  it.each([
    [7, [7, 7]],
    ["2-3", [2, 3]],
    ["91–00", [91, 100]],
    ["00", [100, 100]],
    ["{@area 4|12a|x}", [4, 4]],
    [{ type: "cell", roll: { exact: 4, pad: true } }, [4, 4]],
    [{ type: "cell", roll: { min: 5, max: 6 } }, [5, 6]],
    [{ type: "cell", entry: "10-12" }, [10, 12]],
  ])("reads %j as %j", (cell, range) => expect(rowRange(cell)).toEqual(range));

  it.each(["", "—", "Goblin", { type: "cell" }, null])("reads no range from %j", (cell) =>
    expect(rowRange(cell)).toBeUndefined(),
  );
});

describe("rowFor", () => {
  const rows = [
    ["01-05", "a"],
    ["06–50", "b"],
    [{ type: "cell", roll: { exact: 51 } }, "c"],
  ];

  it("finds the row whose range holds the total", () => {
    expect(rowFor(rows, 1)).toBe(0);
    expect(rowFor(rows, 50)).toBe(1);
    expect(rowFor(rows, 51)).toBe(2);
  });

  it("finds no row for a total outside every range", () => {
    expect(rowFor(rows, 52)).toBe(-1);
  });
});
