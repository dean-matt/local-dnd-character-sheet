import type { Term } from "@dnd/rules";
import { z } from "zod";
import { type HouseRule, PRINTED_RULE } from "./houseRules.ts";
import { type ContentRef, contentRefSchema } from "./refs.ts";

/**
 * What a `Term` traces to, the vocabulary `rules` never sees: a catalog row a
 * character references by `(name, source)`, another derived field on the same
 * character, or the house-rule option that changed the arithmetic instead of the
 * printed rule. `character` owns this union because it owns all three vocabularies.
 */
export type TermReference = ContentRef | { derivedField: string } | { houseRuleOption: HouseRule };

const termReferenceSchema = z.union([
  contentRefSchema,
  z.strictObject({ derivedField: z.string() }),
  z.strictObject({
    houseRuleOption: z.enum(Object.keys(PRINTED_RULE) as [HouseRule, ...HouseRule[]]),
  }),
]);

const termSchema = z.strictObject({
  label: z.string(),
  value: z.number(),
  reference: termReferenceSchema.optional(),
});

/**
 * A computed field a user may have typed over. A null `manual` is the absent
 * `field_overrides` row: use the computed value. There is no third state,
 * because the table has nowhere to hold a manual value that is switched off.
 *
 * Writing `manual` never touches `computed`, so a level-up recomputes without
 * stomping the edit.
 *
 * `terms` is the breakdown behind `computed`, empty where no breakdown assembles the
 * field yet. An override needs no explanation beyond itself, so nothing here recomputes
 * `terms` against `manual`.
 */
export function derivedSchema<T extends z.ZodType>(value: T) {
  return z.strictObject({
    computed: value,
    manual: value.nullable().default(null),
    terms: z.array(termSchema).default([]),
  });
}

export type Derived<T> = { computed: T; manual: T | null; terms?: Term<TermReference>[] };
