/**
 * What the catalog says of itself — its build stamp and the title and group of each source
 * it holds — and the rows of each type no route of its own reads.
 */

import { catalogRowRecordSchema, catalogSourcesResponseSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getCatalogMeta, getCatalogSources } from "../db/queries/catalog-meta.ts";
import { type CatalogRow, getCatalogRow } from "../db/queries/catalog-row.ts";
import { errorSchema, notFound } from "./errors.ts";

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
  summary: "The title and group of every book and adventure the catalog cites as a source",
  responses: {
    200: {
      description: "Each source abbreviation, its title, and its group",
      content: { "application/json": { schema: catalogSourcesResponseSchema } },
    },
    503: notBuilt,
  },
});

const read = createRoute({
  method: "get",
  path: "/catalog/{type}/{name}/{source}",
  tags: ["catalog"],
  summary: "Read one optional feature, lookup or entity row by the type a search hit carries",
  request: {
    params: z.object({
      type: z.string().openapi({ example: "condition" }),
      name: z.string().openapi({ example: "Restrained" }),
      source: z.string().openapi({ example: "XPHB" }),
    }),
    query: z.object({
      qualifier: z
        .string()
        .min(1)
        .optional()
        .openapi({ description: "A deity's pantheon or a card's deck", example: "Dwarven" }),
    }),
  },
  responses: {
    200: {
      description: "The row",
      content: { "application/json": { schema: catalogRowRecordSchema } },
    },
    404: notFound("row", "type, name, source and qualifier"),
  },
});

function toCatalogRowRecord({ qualifier, json, ...row }: CatalogRow) {
  return catalogRowRecordSchema.parse({
    ...row,
    ...(qualifier === "" ? {} : { qualifier }),
    json: JSON.parse(json),
  });
}

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

  routes.openapi(read, (c) => {
    const { type, name, source } = c.req.valid("param");
    const row = getCatalogRow(dataDir, type, name, source, c.req.valid("query").qualifier ?? "");
    if (!row) return c.json({ error: "No row with that type, name, source and qualifier" }, 404);
    return c.json(toCatalogRowRecord(row), 200);
  });

  return routes;
}
