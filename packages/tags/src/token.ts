/**
 * The token contract and the helpers that build one.
 *
 * Every token carries display text, so a renderer can fall back to it without knowing
 * the tag. `Spec` says where a given tag keeps that display text, which is the whole
 * reason the parser is a table rather than one splitter.
 */

export type Token =
  | { kind: "text"; value: string }
  | { kind: "ref"; tag: string; name: string; source?: string; display: string }
  | { kind: "roll"; notation: string; display: string; rollable: boolean }
  | { kind: "style"; style: "italic" | "bold"; children: Token[] };

export type RefToken = Extract<Token, { kind: "ref" }>;
type RollToken = Extract<Token, { kind: "roll" }>;

/**
 * Which argument holds what, per tag. The position of the display argument is not
 * uniform: `{@spell a|b|c}` displays `c`, `{@dice a|b}` displays `b`, and
 * `{@filter a|b|c}` displays `a`. A `source` is a chain because upstream defaults a
 * feature's source to the subclass or class it belongs to.
 */
export type Spec =
  | { kind: "ref"; source: number[]; display: number }
  | { kind: "roll"; notation: number; display: number }
  | { kind: "text"; display: number }
  | { kind: "style"; style: "italic" | "bold" }
  | { kind: "wrapper" }
  | { kind: "computed"; render: (args: string[]) => Token };

export const text = (value: string): Token => ({ kind: "text", value });

/** An empty argument means "default", not an empty string. */
export function arg(args: string[], index: number): string | undefined {
  const value = args[index];
  return value === undefined || value === "" ? undefined : value;
}

/**
 * Deliberately a second copy of the grammar `@dnd/dice` parses. Sharing it would mean
 * this package depending on `dice`, against the package split, and the duplication is
 * the cheaper of the two — a grammar that has not changed since it was written, against
 * an inverted dependency.
 */
const NOTATION = /^\s*(\d*)\s*d\s*\d+(?:\s*k\s*[hl]\s*(\d+))?(?:\s*[+-]\s*\d+)?\s*$/i;

/**
 * Conservative, because `@dnd/dice` is the authority. A false negative costs a
 * click-to-roll button; a false positive throws there, which the roll layer has to
 * handle regardless.
 *
 * Keeping more dice than are rolled is checked because it contradicts itself rather
 * than exceeding a limit. `dice` also caps count, faces and modifier, and those numbers
 * are not copied — one authority for a bound that may move.
 */
export function rollable(notation: string): boolean {
  const match = NOTATION.exec(notation);
  if (match === null) return false;
  const [, rawCount, rawKeep] = match;
  if (rawKeep === undefined) return true;
  return Number(rawKeep) <= (rawCount === "" ? 1 : Number(rawCount));
}

/** Shared by every tag that renders a d20 bonus rather than notation. */
export function d20(bonus: string): RollToken {
  const signed = /^[+-]/.test(bonus) ? bonus : `+${bonus}`;
  const notation = `1d20${signed}`;
  return { kind: "roll", notation, display: signed, rollable: rollable(notation) };
}
