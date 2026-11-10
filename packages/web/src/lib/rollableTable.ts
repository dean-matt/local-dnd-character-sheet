import { isRollable } from "@dnd/dice";
import { parseTags, renderText } from "@dnd/tags";
import { isRecord, str } from "./entryGuards.ts";

/**
 * The die a table's first column label names, as `d100` or `{@dice 2d4}`, or undefined where
 * the label is anything else — `Wyrmling d8`, `d6 + Level` — or names nothing the dice roll.
 */
export function tableDie(label: unknown): string | undefined {
  if (typeof label !== "string") return undefined;
  const tokens = parseTags(label).filter((token) => token.kind !== "text" || token.value.trim());
  const [only] = tokens;
  if (tokens.length !== 1 || only === undefined) return undefined;
  const notation =
    only.kind === "roll" && only.tag === "dice"
      ? only.notation
      : only.kind === "text"
        ? only.value.trim()
        : undefined;
  return notation !== undefined && /^\d*d\d+$/.test(notation) && isRollable(notation)
    ? notation
    : undefined;
}

/** A d100 table writes 100 as `00`. */
const bound = (written: string) => (written === "00" ? 100 : Number(written));

/**
 * The totals a row's first cell covers: `7`, `"2-3"`, `"91–00"`, `{@area 4|...}`, or a
 * `{ type: "cell" }` holding its own text or an `exact`/`min`-`max` roll.
 */
export function rowRange(cell: unknown): readonly [number, number] | undefined {
  if (typeof cell === "number") return [cell, cell];
  if (isRecord(cell)) {
    const text = str(cell.entry);
    if (text !== undefined) return rowRange(text);
    const roll = cell.roll;
    if (!isRecord(roll)) return undefined;
    if (typeof roll.exact === "number") return [roll.exact, roll.exact];
    if (typeof roll.min === "number" && typeof roll.max === "number") return [roll.min, roll.max];
    return undefined;
  }
  if (typeof cell !== "string") return undefined;
  const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/.exec(renderText(parseTags(cell)));
  if (match?.[1] === undefined) return undefined;
  return [bound(match[1]), bound(match[2] ?? match[1])];
}

/** The index of the row whose first cell covers `total`, or -1 where none does. */
export function rowFor(rows: readonly unknown[], total: number): number {
  return rows.findIndex((row) => {
    const range = Array.isArray(row) ? rowRange(row[0]) : undefined;
    return range !== undefined && range[0] <= total && total <= range[1];
  });
}
