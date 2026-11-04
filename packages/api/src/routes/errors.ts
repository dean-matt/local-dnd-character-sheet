/** The `{ error: string }` body every route that fails with a message returns, and the handler for what a route throws. */
import { type CatalogOutOfDate, catalogOutOfDateSchema } from "@dnd/catalog";
import { z } from "@hono/zod-openapi";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { CatalogOutOfDateError } from "../db/content.ts";

export const errorSchema = z.object({ error: z.string() });

export const notFound = (resource: string, identifiedBy = "id") => ({
  description: `No ${resource} with that ${identifiedBy}`,
  content: { "application/json": { schema: errorSchema } },
});

export const catalogOutOfDate = {
  description: "The catalog was built from a different schema; `pnpm content:build` rebuilds it",
  content: { "application/json": { schema: catalogOutOfDateSchema } },
};

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

/** A union fails with one issue per branch; the branch nearest to matching is the one worth naming. */
function flattenIssues(issues: readonly z.core.$ZodIssue[]): z.core.$ZodIssue[] {
  return issues.flatMap((issue) => {
    if (issue.code !== "invalid_union") return [issue];
    const nearest = issue.errors.reduce((best, each) => (each.length < best.length ? each : best));
    return flattenIssues(nearest);
  });
}

/** Names each field an imported file fails on, so the person importing it can find the field. */
export function describeIssues(error: z.ZodError, file: string): string {
  const issues = flattenIssues(error.issues).map(
    (issue) => `${issue.path.join(".") || "file"}: ${issue.message}`,
  );
  return `Not a ${file} file this build can read. ${issues.join("; ")}`;
}
