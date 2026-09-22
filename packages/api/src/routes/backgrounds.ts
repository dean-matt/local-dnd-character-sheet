/**
 * Reads `content.db`'s `backgrounds` table. Homebrew backgrounds live in `homebrew.db`
 * but are not merged in here — that merge is separate work, the way it was for items and
 * spells. Creating, renaming or deleting one stays with `/homebrew/backgrounds`.
 */
import { type BackgroundRecord, backgroundRecordSchema } from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type BackgroundRow, getBackground, listBackgrounds } from "../db/queries/content.ts";
import { notFound } from "./errors.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toBackgroundRecord(row: BackgroundRow): BackgroundRecord {
  return backgroundRecordSchema.parse({ ...row, json: JSON.parse(row.json) });
}

const listQuery = z.object({
  edition: z.enum(EDITIONS),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const backgroundListResponseSchema = z.object({
  items: z.array(backgroundRecordSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const list = createRoute({
  method: "get",
  path: "/backgrounds",
  tags: ["backgrounds"],
  summary: "List backgrounds of one edition",
  request: { query: listQuery },
  responses: {
    200: {
      description: "A page of backgrounds, bounded by limit and offset",
      content: { "application/json": { schema: backgroundListResponseSchema } },
    },
  },
});

const nameSourceParam = z.object({ name: z.string(), source: z.string() });

const read = createRoute({
  method: "get",
  path: "/backgrounds/{name}/{source}",
  tags: ["backgrounds"],
  summary: "Read one background by name and source",
  request: { params: nameSourceParam },
  responses: {
    200: {
      description: "The background",
      content: { "application/json": { schema: backgroundRecordSchema } },
    },
    404: notFound("background", "name and source"),
  },
});

const BACKGROUND_NOT_FOUND = "No background with that name and source";

export function backgroundsRoutes(dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(list, (c) => {
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const backgrounds = listBackgrounds(dataDir, edition).map(toBackgroundRecord);
    return c.json({
      items: backgrounds.slice(offset, offset + limit),
      total: backgrounds.length,
      limit,
      offset,
    });
  });

  routes.openapi(read, (c) => {
    const { name, source } = c.req.valid("param");
    const row = getBackground(dataDir, name, source);
    if (!row) return c.json({ error: BACKGROUND_NOT_FOUND }, 404);
    return c.json(toBackgroundRecord(row), 200);
  });

  return routes;
}
