import { z } from "zod";

/** What the API answers while the catalog predates its schema; backticks mark the command. */
export const CATALOG_OUT_OF_DATE =
  "The catalog was built from a different schema. Run `pnpm content:build` to rebuild it.";

/** What the API answers while no catalog has been built; backticks mark the command. */
export const CATALOG_MISSING = "No catalog has been built. Run `pnpm content:build` to build it.";

/** The 503 body of any route that reads a catalog built from another schema, or none. */
export const catalogOutOfDateSchema = z.object({
  error: z.string(),
  code: z.literal("catalog_out_of_date"),
});

export type CatalogOutOfDate = z.infer<typeof catalogOutOfDateSchema>;
