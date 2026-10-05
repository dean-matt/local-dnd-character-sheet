import { z } from "zod";

/** A source abbreviation beside the title of the book or adventure that prints it. */
const catalogSourceSchema = z.strictObject({
  source: z.string().min(1),
  name: z.string().min(1),
});

/** Every source upstream's book and adventure indexes name, one row each. */
export const catalogSourcesResponseSchema = z.object({ sources: z.array(catalogSourceSchema) });

export type CatalogSource = z.infer<typeof catalogSourceSchema>;

/**
 * A source some searchable row cites. `name` is null where no book or adventure index
 * titles it, as for a playtest document.
 */
const searchSourceSchema = z.strictObject({
  source: z.string().min(1),
  name: z.string().min(1).nullable(),
});

/** Every source `/search` can return a row from, one row each, by abbreviation. */
export const searchSourcesResponseSchema = z.object({ sources: z.array(searchSourceSchema) });

export type SearchSource = z.infer<typeof searchSourceSchema>;
