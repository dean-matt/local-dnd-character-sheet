/**
 * Dice notation parsing and rolling.
 *
 * `rollDice` is the only entry point. It takes standard notation
 * (`2d6+3`, `4d6kh3`) plus an optional mode and random source, and returns every
 * die it rolled — including the ones a keep clause discarded — so the roll log can
 * show the whole pool.
 */

export type RolledDie = {
  faces: number;
  value: number;
  /** False for a die a keep clause, advantage or disadvantage discarded. */
  kept: boolean;
};

export type Roll = {
  total: number;
  dice: RolledDie[];
  modifier: number;
  notation: string;
};

/**
 * Advantage and disadvantage are a mode rather than notation: the rules apply them to
 * a roll a character sheet already knows how to make, not to a string a user typed.
 */
export type RollMode = "normal" | "advantage" | "disadvantage";

export type RollOptions = {
  mode?: RollMode;
  /** Returns a float in [0, 1), like `Math.random`. Injected so tests are deterministic. */
  random?: () => number;
};

/** Bounds a single roll, so notation from upstream data cannot ask for a million dice. */
const MAX_COUNT = 1000;
const MAX_FACES = 1000;

const NOTATION = /^(\d*)d(\d+)(?:k([hl])(\d+))?(?:([+-])(\d+))?$/i;

type Keep = { high: boolean; count: number };

type ParsedDice = {
  count: number;
  faces: number;
  keep: Keep | null;
  modifier: number;
};

function parseDice(notation: string): ParsedDice {
  const match = NOTATION.exec(notation.replaceAll(/\s+/g, ""));
  if (match === null) {
    throw new SyntaxError(`Invalid dice notation: "${notation}"`);
  }

  const [, rawCount, rawFaces, keepKind, rawKeep, sign, rawModifier] = match;
  const count = rawCount === "" ? 1 : Number(rawCount);
  const faces = Number(rawFaces);

  if (count < 1 || count > MAX_COUNT) {
    throw new RangeError(`Dice count must be 1-${MAX_COUNT}: "${notation}"`);
  }
  if (faces < 1 || faces > MAX_FACES) {
    throw new RangeError(`Die faces must be 1-${MAX_FACES}: "${notation}"`);
  }

  let keep: Keep | null = null;
  if (keepKind !== undefined) {
    const keepCount = Number(rawKeep);
    if (keepCount < 1 || keepCount > count) {
      throw new RangeError(`Cannot keep ${keepCount} of ${count} dice: "${notation}"`);
    }
    keep = { high: keepKind.toLowerCase() === "h", count: keepCount };
  }

  const modifier = rawModifier === undefined ? 0 : Number(`${sign}${rawModifier}`);
  return { count, faces, keep, modifier };
}

function markKept(dice: RolledDie[], keep: Keep | null): void {
  if (keep === null) {
    for (const die of dice) die.kept = true;
    return;
  }
  const ranked = dice
    .map((die, index) => ({ die, index }))
    .sort((a, b) => (keep.high ? b.die.value - a.die.value : a.die.value - b.die.value));
  ranked.forEach(({ die }, rank) => {
    die.kept = rank < keep.count;
  });
}

/**
 * Rolls `notation`, throwing a `SyntaxError` or `RangeError` naming the offending input.
 *
 * Advantage and disadvantage roll the pool twice and keep the better or worse half, so
 * both d20s appear in `dice`. They cannot be combined with an explicit keep clause.
 */
export function rollDice(notation: string, options: RollOptions = {}): Roll {
  const { mode = "normal", random = Math.random } = options;
  const { count, faces, keep, modifier } = parseDice(notation);

  if (mode !== "normal" && keep !== null) {
    throw new SyntaxError(`${mode} cannot be combined with a keep clause: "${notation}"`);
  }

  const pool = mode === "normal" ? count : count * 2;
  const applied = mode === "normal" ? keep : { high: mode === "advantage", count };

  const dice: RolledDie[] = Array.from({ length: pool }, () => ({
    faces,
    value: Math.floor(random() * faces) + 1,
    kept: true,
  }));
  markKept(dice, applied);

  const total = dice.reduce((sum, die) => sum + (die.kept ? die.value : 0), 0) + modifier;
  return { total, dice, modifier, notation };
}
