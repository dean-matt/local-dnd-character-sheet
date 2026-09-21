/** The `{ error: string }` body every route that fails with a message returns. */
import { z } from "@hono/zod-openapi";

export const errorSchema = z.object({ error: z.string() });

export const notFound = (resource: string, identifiedBy = "id") => ({
  description: `No ${resource} with that ${identifiedBy}`,
  content: { "application/json": { schema: errorSchema } },
});
