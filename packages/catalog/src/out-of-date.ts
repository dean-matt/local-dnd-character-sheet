import { z } from "zod";

/** The 503 body of any route that reads a catalog built from another schema. */
export const catalogOutOfDateSchema = z.object({
  error: z.string(),
  code: z.literal("catalog_out_of_date"),
});

export type CatalogOutOfDate = z.infer<typeof catalogOutOfDateSchema>;
