/** The 404 body every route that looks up a resource by id returns. */
import { z } from "@hono/zod-openapi";

const errorSchema = z.object({ error: z.string() });

export const notFound = (resource: string) => ({
  description: `No ${resource} with that id`,
  content: { "application/json": { schema: errorSchema } },
});
