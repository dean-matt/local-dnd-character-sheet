/** The 404 body every route that looks up a resource by a key returns. */
import { z } from "@hono/zod-openapi";

const errorSchema = z.object({ error: z.string() });

export const notFound = (resource: string, identifiedBy = "id") => ({
  description: `No ${resource} with that ${identifiedBy}`,
  content: { "application/json": { schema: errorSchema } },
});
