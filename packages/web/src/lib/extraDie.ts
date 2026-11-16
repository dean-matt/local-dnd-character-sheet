import { isRollable } from "@dnd/dice";

const EXTRA_DIE = /^\s*([+-])?\s*(\d*)\s*d\s*(\d+)\s*$/i;

type ExtraDie = {
  /** Signed, for appending to a d20's notation; empty where there is no die. */
  notation: string;
  count: number;
  /** What to speak where the text is not a die. */
  error?: string;
};

/**
 * A die an ally grants or takes, as a player types it: `+1d4`, `-1d4`, `d6`. Blank is no die.
 */
export function parseExtraDie(text: string): ExtraDie {
  if (text.trim() === "") return { notation: "", count: 0 };
  const match = EXTRA_DIE.exec(text);
  const count = match?.[2] ? Number(match[2]) : 1;
  const notation = match === null ? "" : `${match[1] ?? "+"}${count}d${match[3]}`;
  if (match === null || !isRollable(`1d20${notation}`)) {
    return { notation: "", count: 0, error: `"${text.trim()}" is not a die such as +1d4 or -1d4` };
  }
  return { notation, count };
}

/** The signed sum of the last `count` dice of a roll, where the extra die rolls. */
export function extraTotal(dice: readonly { value: number; sign: 1 | -1 }[], count: number) {
  return dice.slice(-count).reduce((sum, die) => sum + die.sign * die.value, 0);
}
