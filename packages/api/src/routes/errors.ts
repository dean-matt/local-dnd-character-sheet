/** The `{ error: string }` body every route that fails with a message returns, and the handler for what a route throws. */
import type { CatalogOutOfDate } from "@dnd/catalog";
import { z } from "@hono/zod-openapi";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { CatalogOutOfDateError } from "../db/content.ts";

export const errorSchema = z.object({ error: z.string() });

export const notFound = (resource: string, identifiedBy = "id") => ({
  description: `No ${resource} with that ${identifiedBy}`,
  content: { "application/json": { schema: errorSchema } },
});

/**
 * The app's error handler: a catalog built from another schema answers 503 naming the
 * rebuild, and anything else falls through to what Hono does by default.
 */
export const onAppError: ErrorHandler = (error, c) => {
  if (error instanceof CatalogOutOfDateError) {
    const body: CatalogOutOfDate = { error: error.message, code: "catalog_out_of_date" };
    return c.json(body, 503);
  }
  if (error instanceof HTTPException) return error.getResponse();
  console.error(error);
  return c.text("Internal Server Error", 500);
};
