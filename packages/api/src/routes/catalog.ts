/** What the catalog says of itself: its build stamp and the title of each source it holds. */

import { catalogSourcesResponseSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getCatalogMeta, getCatalogSources } from "../db/queries/catalog-meta.ts";
import { errorSchema } from "./errors.ts";

const catalogMetaRowSchema = z.object({ key: z.string(), value: z.string() });

const catalogMetaResponseSchema = z.object({ meta: z.array(catalogMetaRowSchema) });

const notBuilt = {
  description: "No catalog has been built yet",
  content: { "application/json": { schema: errorSchema } },
};

const meta = createRoute({
  method: "get",
  path: "/catalog/meta",
  tags: ["catalog"],
  summary: "The build stamp of the currently live catalog",
  responses: {
    200: {
      description: "The catalog's meta rows",
      content: { "application/json": { schema: catalogMetaResponseSchema } },
    },
    503: notBuilt,
  },
});

/** Unbounded, unlike a row list: upstream indexes a few hundred volumes, not thousands. */
const sources = createRoute({
  method: "get",
  path: "/catalog/sources",
  tags: ["catalog"],
  summary: "The title of every book and adventure the catalog cites as a source",
  responses: {
    200: {
      description: "Each source abbreviation and its title",
      content: { "application/json": { schema: catalogSourcesResponseSchema } },
    },
    503: notBuilt,
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

  routes.openapi(sources, (c) => {
    const rows = getCatalogSources(dataDir);
    if (!rows) return c.json({ error: CATALOG_NOT_BUILT }, 503);
    return c.json({ sources: rows }, 200);
  });

  return routes;
}
