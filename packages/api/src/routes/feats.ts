/** Reads `content.db`'s `feats` table. No homebrew feat exists to merge in. */
import { type FeatRecord, featRecordSchema } from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type FeatRow, getFeat, listFeats } from "../db/queries/content.ts";
import { notFound } from "./errors.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toFeatRecord(row: FeatRow): FeatRecord {
  return featRecordSchema.parse({ ...row, json: JSON.parse(row.json) });
}

const listQuery = z.object({
  edition: z.enum(EDITIONS),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const featListResponseSchema = z.object({
  items: z.array(featRecordSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const list = createRoute({
  method: "get",
  path: "/feats",
  tags: ["feats"],
  summary: "List feats of one edition",
  request: { query: listQuery },
  responses: {
    200: {
      description: "A page of feats, bounded by limit and offset",
      content: { "application/json": { schema: featListResponseSchema } },
    },
  },
});

const nameSourceParam = z.object({ name: z.string(), source: z.string() });

const read = createRoute({
  method: "get",
  path: "/feats/{name}/{source}",
  tags: ["feats"],
  summary: "Read one feat by name and source",
  request: { params: nameSourceParam },
  responses: {
    200: {
      description: "The feat",
      content: { "application/json": { schema: featRecordSchema } },
    },
    404: notFound("feat", "name and source"),
  },
});

const FEAT_NOT_FOUND = "No feat with that name and source";

export function featsRoutes(dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(list, (c) => {
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const feats = listFeats(dataDir, edition).map(toFeatRecord);
    return c.json({
      items: feats.slice(offset, offset + limit),
      total: feats.length,
      limit,
      offset,
    });
  });

  routes.openapi(read, (c) => {
    const { name, source } = c.req.valid("param");
    const row = getFeat(dataDir, name, source);
    if (!row) return c.json({ error: FEAT_NOT_FOUND }, 404);
    return c.json(toFeatRecord(row), 200);
  });

  return routes;
}
