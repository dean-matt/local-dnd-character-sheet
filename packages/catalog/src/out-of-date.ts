import { z } from "zod";

/** What the API answers while the catalog predates its schema; backticks mark the command. */
export const CATALOG_OUT_OF_DATE =
  "The catalog was built from a different schema. Run `pnpm content:build` to rebuild it.";

/** The 503 body of any route that reads a catalog built from another schema. */
export const catalogOutOfDateSchema = z.object({
  error: z.string(),
  code: z.literal("catalog_out_of_date"),
});

export type CatalogOutOfDate = z.infer<typeof catalogOutOfDateSchema>;
