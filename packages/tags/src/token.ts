/**
 * The token contract and the helpers that build one.
 *
 * Every token carries display text, so a renderer can fall back to it without knowing
 * the tag. `Spec` says where a given tag keeps that display text, which is the whole
 * reason the parser is a table rather than one splitter.
 */

import { isRollable } from "@dnd/dice";

export type Token =
  | { kind: "text"; value: string }
  | { kind: "ref"; tag: string; name: string; source?: string; display: string }
  | { kind: "roll"; notation: string; display: string; rollable: boolean }
  | { kind: "style"; style: "italic" | "bold"; children: Token[] };

export type RefToken = Extract<Token, { kind: "ref" }>;

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
 * Shared by every tag that renders a d20 bonus rather than notation. A tag that omits
 * the bonus has nothing to roll, and a lone `+` is worse than nothing.
 */
export function d20(bonus: string): Token {
  if (bonus === "") return text("");
  const signed = /^[+-]/.test(bonus) ? bonus : `+${bonus}`;
  const notation = `1d20${signed}`;
  return { kind: "roll", notation, display: signed, rollable: isRollable(notation) };
}
