import type { Derived } from "@dnd/character";

/** A derived field's terms as the terms a logged roll records, or none where a manual value replaced them. */
export const rollTerms = (
  field: Derived<number>,
): { source: string; value: number }[] | undefined =>
  field.manual === null
    ? field.terms?.map(({ label, value }) => ({ source: label, value }))
    : undefined;
