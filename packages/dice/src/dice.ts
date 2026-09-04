/**
 * Dice notation parsing and rolling.
 *
 * `rollDice` is the only entry point. It takes standard notation (`2d6+3`, `4d6kh3`)
 * and a random source, and returns every die it rolled — including the ones a keep
 * clause discarded — so the roll log can show the whole pool. An advantage or
 * disadvantage mode is legal only on single-die, keep-free notation.
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
  /** The notation in canonical form, so spacing does not split the roll log. */
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
const MAX_MODIFIER = 1000;

/**
 * Spaces are tolerated around the operators but not inside a number, where `1d6 4`
 * would otherwise silently become a d64.
 */
const NOTATION = /^(\d*)\s*d\s*(\d+)(?:\s*k\s*([hl])\s*(\d+))?(?:\s*([+-])\s*(\d+))?$/i;

type Keep = { high: boolean; count: number };

type ParsedDice = {
  count: number;
  faces: number;
  keep: Keep | null;
  modifier: number;
};

function parseDice(notation: string): ParsedDice {
  const match = NOTATION.exec(notation.trim());
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
  if (Math.abs(modifier) > MAX_MODIFIER) {
    throw new RangeError(`Modifier must be within ${MAX_MODIFIER}: "${notation}"`);
  }

  return { count, faces, keep, modifier };
}

function canonical({ count, faces, keep, modifier }: ParsedDice): string {
  const keptPart = keep === null ? "" : `k${keep.high ? "h" : "l"}${keep.count}`;
  const modifierPart = modifier === 0 ? "" : `${modifier < 0 ? "-" : "+"}${Math.abs(modifier)}`;
  return `${count}d${faces}${keptPart}${modifierPart}`;
}

function markKept(dice: RolledDie[], keep: Keep | null): void {
  if (keep === null) {
    for (const die of dice) die.kept = true;
    return;
  }
  const ranked = [...dice].sort((a, b) => (keep.high ? b.value - a.value : a.value - b.value));
  ranked.forEach((die, rank) => {
    die.kept = rank < keep.count;
  });
}

/**
 * Rolls `notation`, throwing a `SyntaxError` for malformed notation and a `RangeError`
 * for a quantity out of bounds, both naming the offending input.
 *
 * Advantage and disadvantage roll a second die and keep the higher or lower, so both
 * appear in `dice`. The rules only ever apply them to a single die, so notation rolling
 * a pool or carrying its own keep clause is rejected rather than reinterpreted — a
 * `TypeError`, since the notation itself is fine and only the pairing is wrong.
 */
export function rollDice(notation: string, options: RollOptions = {}): Roll {
  const { mode = "normal", random = Math.random } = options;
  const parsed = parseDice(notation);
  const { count, faces, keep, modifier } = parsed;

  if (mode !== "normal" && (count !== 1 || keep !== null)) {
    throw new TypeError(`${mode} applies to a single die, not to "${notation}"`);
  }

  const pool = mode === "normal" ? count : 2;
  const applied = mode === "normal" ? keep : { high: mode === "advantage", count: 1 };

  const dice: RolledDie[] = Array.from({ length: pool }, () => ({
    faces,
    value: Math.floor(random() * faces) + 1,
    kept: true,
  }));
  markKept(dice, applied);

  const total = dice.reduce((sum, die) => sum + (die.kept ? die.value : 0), 0) + modifier;
  return { total, dice, modifier, notation: canonical(parsed) };
}
