import { z } from "zod";

/**
 * A source abbreviation beside the title of the book or adventure that prints it, and the
 * shelf upstream files it on: a book's own `group`, such as `core` or `setting`, or
 * `adventure` for an adventure, whose upstream `group` says only supplement.
 */
const catalogSourceSchema = z.strictObject({
  source: z.string().min(1),
  name: z.string().min(1),
  group: z.string().min(1).nullable(),
});

/** Every source upstream's book and adventure indexes name, one row each. */
export const catalogSourcesResponseSchema = z.object({ sources: z.array(catalogSourceSchema) });

export type CatalogSource = z.infer<typeof catalogSourceSchema>;

/** Every source `/search` can return a row from, one abbreviation each, sorted. */
export const searchSourcesResponseSchema = z.object({ sources: z.array(z.string().min(1)) });
