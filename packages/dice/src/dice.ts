/**
 * Dice notation parsing and rolling.
 *
 * `rollDice` is the only entry point. It returns every die from every pool, discarded
 * ones included, so the roll log shows the dice and not a bare total. Advantage and
 * disadvantage are legal only on notation that rolls a single die, keeps it, and sums no
 * second pool; a critical rolls every pool a second time and leaves the modifier alone.
 */

type RolledDie = {
  faces: number;
  value: number;
  /** False for a die discarded by a keep clause, advantage, or disadvantage. */
  kept: boolean;
  /**
   * `-1` for a die in a subtracted pool, as the `1d4` of `2d6-1d4`. Signing the die lets
   * a log add the dice up and reach the same `total`.
   */
  sign: 1 | -1;
};

type Roll = {
  total: number;
  dice: RolledDie[];
  modifier: number;
  /** The notation in canonical form, so spacing does not split the roll log. */
  notation: string;
};

/**
 * A mode rather than notation: the sheet knows a roll is a d20 test before any notation
 * exists, and `2d20kh1` leaves the log unable to explain the second die.
 */
type RollMode = "normal" | "advantage" | "disadvantage";

type RollOptions = {
  mode?: RollMode;
  /**
   * Rolls every pool a second time and adds the modifier once, as a critical hit does. An
   * option rather than notation for the same reason a mode is: doubling the string
   * `1d8+3` gives `2d8+6`, wrong by the modifier.
   */
  critical?: boolean;
  /** Returns a float in [0, 1), like `Math.random`. Injected so tests are deterministic. */
  random?: () => number;
};

/** Bounds a single roll, so notation from upstream data cannot ask for a million dice. */
const MAX_COUNT = 1000;
const MAX_FACES = 1000;
const MAX_MODIFIER = 1000;

/**
 * One term of an already-lowercased notation: a dice pool with an optional keep or drop
 * clause, or a bare constant. Spaces may surround the operators but never split a number,
 * because `1d6 4` would otherwise become a d64. A keep clause names its end, because `k`
 * alone says neither highest nor lowest; a drop clause defaults to the lowest, so the
 * second `d` of `4d6d1` reads by position as a drop, not as another die separator. A
 * constant runs to the next operator or to the end, so the `1` of `1d` cannot pass for
 * one and the truncated die reports itself as malformed.
 */
const TERM =
  /\s*(?:(?<count>\d*)\s*d\s*(?<faces>\d+)(?:\s*k\s*(?<keep>[hl])\s*(?<keepCount>\d+)|\s*d\s*(?<drop>[hl]?)\s*(?<dropCount>\d+))?|(?<constant>\d+)(?=\s*[+-]|\s*$))\s*/y;

const OPERATOR = /([+-])/y;

type Keep = { high: boolean; count: number };

type DiceTerm = { sign: 1 | -1; count: number; faces: number; keep: Keep | null };

type ParsedDice = {
  terms: DiceTerm[];
  modifier: number;
  /** Every pool's dice counted together, which a critical doubles. */
  pooled: number;
};

type TermGroups = {
  count?: string;
  faces?: string;
  keep?: string;
  keepCount?: string;
  drop?: string;
  dropCount?: string;
  constant?: string;
};

function parseTerm(groups: TermGroups, sign: 1 | -1, notation: string): DiceTerm {
  const count = groups.count === undefined || groups.count === "" ? 1 : Number(groups.count);
  const faces = Number(groups.faces);

  if (count < 1 || count > MAX_COUNT) {
    throw new RangeError(`Dice count must be 1-${MAX_COUNT}: "${notation}"`);
  }
  if (!Number.isInteger(faces) || faces < 1 || faces > MAX_FACES) {
    throw new RangeError(`Die faces must be 1-${MAX_FACES}: "${notation}"`);
  }

  let keep: Keep | null = null;
  if (groups.keep !== undefined) {
    const keepCount = Number(groups.keepCount);
    if (keepCount < 1 || keepCount > count) {
      throw new RangeError(`Cannot keep ${keepCount} of ${count} dice: "${notation}"`);
    }
    keep = { high: groups.keep === "h", count: keepCount };
  } else if (groups.drop !== undefined) {
    const dropCount = Number(groups.dropCount);
    if (dropCount >= count) {
      throw new RangeError(`Cannot drop ${dropCount} of ${count} dice: "${notation}"`);
    }
    keep = { high: groups.drop !== "h", count: count - dropCount };
  }

  // A clause that discards nothing is no clause: `4d6kh4`, `4d6d0` and `4d6` are one
  // roll, so they take one row in the log and one answer from the advantage guard.
  return { sign, count, faces, keep: keep !== null && keep.count === count ? null : keep };
}

/**
 * Each constant is bounded on its own and not only in the sum, because two past the bound
 * cancel into a value neither the sum nor a double can represent: `1e19-9.99e18` loses
 * the 1 it should carry, and a pair of 400-digit constants cancels to `NaN`.
 */
function parseConstant(raw: string, notation: string): number {
  const constant = Number(raw);
  if (constant > MAX_MODIFIER) {
    throw new RangeError(`Modifier must be within ${MAX_MODIFIER}: "${notation}"`);
  }
  return constant;
}

function checkPooled(pooled: number, notation: string): void {
  if (pooled > MAX_COUNT) {
    throw new RangeError(
      `Cannot roll more than ${MAX_COUNT} dice at once, and this asks for ${pooled}: "${notation}"`,
    );
  }
}

function parseDice(notation: string): ParsedDice {
  // Collapsing each whitespace run leaves the grammar alone — `\s*` reads one space the
  // same as ten — and caps `TERM`'s backtracking, quadratic in a run's length on notation
  // that fails. `isRollable` reads every {@dice} argument, so homebrew chooses that input.
  const source = notation.trim().toLowerCase().replace(/\s+/g, " ");
  const terms: DiceTerm[] = [];
  let modifier = 0;
  let sign: 1 | -1 = 1;
  let index = 0;

  for (;;) {
    TERM.lastIndex = index;
    const match = TERM.exec(source);
    if (match === null || match.groups === undefined) {
      throw new SyntaxError(`Invalid dice notation: "${notation}"`);
    }
    index = TERM.lastIndex;

    const groups: TermGroups = match.groups;
    if (groups.constant === undefined) {
      terms.push(parseTerm(groups, sign, notation));
    } else if (terms.length === 0) {
      // `3-1d6` would canonicalize to `-1d6+3`, which the grammar rejects, so `notation`
      // would stop round-tripping. `3+1d6` round-trips and goes anyway: a roll starts with
      // a pool, rather than starting with one whenever the sign happens to allow it.
      throw new SyntaxError(`Dice notation must start with a die: "${notation}"`);
    } else {
      modifier += sign * parseConstant(groups.constant, notation);
    }

    if (index === source.length) break;

    OPERATOR.lastIndex = index;
    const operator = OPERATOR.exec(source);
    if (operator === null) {
      throw new SyntaxError(`Invalid dice notation: "${notation}"`);
    }
    index = OPERATOR.lastIndex;
    sign = operator[1] === "-" ? -1 : 1;
  }

  const pooled = terms.reduce((sum, term) => sum + term.count, 0);
  checkPooled(pooled, notation);
  if (Math.abs(modifier) > MAX_MODIFIER) {
    throw new RangeError(`Modifier must be within ${MAX_MODIFIER}: "${notation}"`);
  }

  return { terms, modifier, pooled };
}

/**
 * Rebuilt from the parsed terms, so a drop clause comes back as the keep clause it means,
 * and scattered constants as one trailing modifier.
 */
function canonical({ terms, modifier }: ParsedDice): string {
  const pools = terms
    .map(({ sign, count, faces, keep }, position) => {
      const operator = sign < 0 ? "-" : position === 0 ? "" : "+";
      const keptPart = keep === null ? "" : `k${keep.high ? "h" : "l"}${keep.count}`;
      return `${operator}${count}d${faces}${keptPart}`;
    })
    .join("");
  const modifierPart = modifier === 0 ? "" : `${modifier < 0 ? "-" : "+"}${Math.abs(modifier)}`;
  return `${pools}${modifierPart}`;
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
 * Whether the notation parses, which is what `rollDice` accepts in the default mode. A
 * caller rendering rules text can offer a roll only where one is possible without keeping
 * its own copy of the grammar and the bounds, and because the answer comes from parsing
 * it cannot drift from what `rollDice` uses.
 *
 * It says nothing about the options: a mode needs a single die, no keep clause and no
 * second pool, and a critical doubles the dice against the same bound, so
 * `isRollable("501d6")` is true where a critical `501d6` is not. A caller passing either
 * checks that itself.
 */
export function isRollable(notation: string): boolean {
  try {
    parseDice(notation);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rolls `notation`. Malformed notation throws a `SyntaxError`, a quantity out of bounds
 * a `RangeError`, and every message names the offending input.
 *
 * Advantage and disadvantage roll a second die and keep the higher or the lower, so both
 * appear in `dice`. The rules apply them only to a single die, so a mode paired with a
 * pool, a keep clause, or a second pool is rejected rather than reinterpreted — a
 * `TypeError`, because the notation is valid and only the pairing is wrong.
 *
 * A critical rolls every pool a second time, adds the modifier once, and returns both
 * pools' dice. A mode with it is a `TypeError` too: doubling belongs to a damage roll and
 * a mode to the d20 test that preceded it, so the pair names no roll anyone makes. Each
 * doubled pool resolves its own keep clause, so a critical `4d6kh3` keeps three of four
 * twice rather than six of eight, because doubling repeats the roll the notation describes.
 */
export function rollDice(notation: string, options: RollOptions = {}): Roll {
  const { mode = "normal", critical = false, random = Math.random } = options;
  const parsed = parseDice(notation);
  const { terms, modifier, pooled } = parsed;

  const single = terms.length === 1 ? terms[0] : undefined;
  if (mode !== "normal" && (single === undefined || single.count !== 1 || single.keep !== null)) {
    throw new TypeError(`${mode} applies to a single die, not to "${notation}"`);
  }
  if (critical && mode !== "normal") {
    throw new TypeError(`a critical does not combine with ${mode}: "${notation}"`);
  }
  const repeats = critical ? 2 : 1;
  checkPooled(pooled * repeats, notation);

  const dice: RolledDie[] = [];
  for (const term of terms) {
    const pool = mode === "normal" ? term.count : 2;
    const applied = mode === "normal" ? term.keep : { high: mode === "advantage", count: 1 };
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const rolled: RolledDie[] = Array.from({ length: pool }, () => ({
        faces: term.faces,
        value: Math.floor(random() * term.faces) + 1,
        kept: true,
        sign: term.sign,
      }));
      markKept(rolled, applied);
      dice.push(...rolled);
    }
  }

  const total =
    dice.reduce((sum, die) => sum + (die.kept ? die.sign * die.value : 0), 0) + modifier;
  return { total, dice, modifier, notation: canonical(parsed) };
}
