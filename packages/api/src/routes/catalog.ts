/** The catalog's build stamp: `content.db`'s `meta` table, read without a shell. */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getCatalogMeta } from "../db/queries/content.ts";
import { errorSchema } from "./errors.ts";

const catalogMetaRowSchema = z.object({ key: z.string(), value: z.string() });

const catalogMetaResponseSchema = z.object({ meta: z.array(catalogMetaRowSchema) });

const meta = createRoute({
  method: "get",
  path: "/catalog/meta",
  tags: ["catalog"],
  summary: "The build stamp of the catalog currently live",
  responses: {
    200: {
      description: "The catalog's meta rows",
      content: { "application/json": { schema: catalogMetaResponseSchema } },
    },
    503: {
      description: "No catalog has been built yet",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const CATALOG_NOT_BUILT = "No catalog has been built yet — run `pnpm content:build`.";

export function catalogRoutes(dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(meta, (c) => {
    const rows = getCatalogMeta(dataDir);
    if (!rows) return c.json({ error: CATALOG_NOT_BUILT }, 503);
    return c.json({ meta: rows }, 200);
  });

  return routes;
}
