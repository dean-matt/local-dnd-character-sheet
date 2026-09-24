/**
 * A labeled contribution to a computed total, so a caller can show the arithmetic
 * rather than only its answer.
 *
 * The arithmetic knows a term's meaning — this is the base, this is the modifier and
 * it is capped — but only the caller knows which catalog row, derived field or
 * house-rule option supplied an input. So a term's `reference` is generic: `rules`
 * never inspects it, only echoes back whatever the caller attached, leaving the
 * concrete union of reference kinds to the package that owns that vocabulary.
 */
export type Term<Ref = unknown> = {
  label: string;
  value: number;
  reference?: Ref;
};

/** One term's value and reference, before the arithmetic gives it a label. */
export type TermInput<Ref = unknown> = {
  value: number;
  reference?: Ref;
};

/** A computed total alongside the terms that produced it. */
export type Breakdown<Ref = unknown> = {
  total: number;
  terms: Term<Ref>[];
};

/**
 * Builds a breakdown whose total is the sum of its own terms, so the two can never
 * drift the way a total recomputed beside a hand-assembled list can.
 */
export function breakdown<Ref>(terms: Term<Ref>[]): Breakdown<Ref> {
  return { total: terms.reduce((sum, term) => sum + term.value, 0), terms };
}
