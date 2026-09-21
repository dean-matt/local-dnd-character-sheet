/**
 * Reads the item catalog: `content.db`'s `items` table merged at query time with
 * `homebrew.db`'s homebrew items of the same edition. A homebrew row carries no `source`
 * at the top level and a catalog row carries no `id` — that structural difference is how
 * a caller tells the two apart, without inspecting `source`.
 *
 * The list filters to `item` and `baseitem` kinds — the equipment a character can own,
 * per docs/items.md. The read does not: `(name, source)` resolves any kind, which a
 * `{@item}` reference or a magic-variant expansion needs.
 *
 * `/variants` expands a base item and a magic variant into the specific item they make —
 * `+1 Chain Mail` exists nowhere in `content.db`, so a character's inventory row names
 * both and this resolves them at read time; see docs/items.md.
 *
 * Creating, renaming or deleting a homebrew item stays with `/homebrew/items`; this only
 * reads.
 */
import {
  type HomebrewItemRecord,
  homebrewItemRecordSchema,
  type ItemRecord,
  itemRecordSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getItem, type ItemRow, listItems } from "../db/queries/content.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { listHomebrewItems } from "../db/queries/homebrew.ts";
import { getExpandedItem } from "../db/queries/item-variant.ts";
import { notFound } from "./errors.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toItemRecord(row: ItemRow): ItemRecord {
  return itemRecordSchema.parse({
    name: row.name,
    source: row.source,
    edition: row.edition,
    kind: row.kind,
    type: row.type,
    rarity: row.rarity,
    requiresAttunement: row.requires_attunement === 1,
    json: JSON.parse(row.json),
  });
}

type HomebrewItemRow = ReturnType<typeof listHomebrewItems>[number];

function toHomebrewItemRecord(row: HomebrewItemRow): HomebrewItemRecord {
  return homebrewItemRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

const itemUnionSchema = z.union([itemRecordSchema, homebrewItemRecordSchema]);

const listQuery = z.object({
  edition: z.enum(EDITIONS),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const itemListResponseSchema = z.object({
  items: z.array(itemUnionSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const list = createRoute({
  method: "get",
  path: "/items",
  tags: ["items"],
  summary: "List items of one edition, catalog and homebrew merged",
  request: { query: listQuery },
  responses: {
    200: {
      description: "A page of items, bounded by limit and offset",
      content: { "application/json": { schema: itemListResponseSchema } },
    },
  },
});

const nameSourceParam = z.object({ name: z.string(), source: z.string() });

const read = createRoute({
  method: "get",
  path: "/items/{name}/{source}",
  tags: ["items"],
  summary: "Read one catalog item by name and source",
  request: { params: nameSourceParam },
  responses: {
    200: {
      description: "The item",
      content: { "application/json": { schema: itemRecordSchema } },
    },
    404: notFound("item", "name and source"),
  },
});

const variantParam = z.object({
  name: z.string(),
  source: z.string(),
  variantName: z.string(),
  variantSource: z.string(),
});

const refusedSchema = z.object({ error: z.string() });

const expand = createRoute({
  method: "get",
  path: "/items/{name}/{source}/variants/{variantName}/{variantSource}",
  tags: ["items"],
  summary: "Expand a base item and a magic variant into the specific item they make",
  request: { params: variantParam },
  responses: {
    200: {
      description: "The expanded item",
      content: { "application/json": { schema: itemRecordSchema } },
    },
    404: notFound("base item or magic variant", "name and source"),
    409: {
      description: "The base item does not meet the variant's requirements",
      content: { "application/json": { schema: refusedSchema } },
    },
  },
});

const ITEM_NOT_FOUND = "No item with that name and source";
const VARIANT_NOT_FOUND = "No base item or magic variant with that name and source";
const VARIANT_REFUSED = "This base item does not meet the variant's requirements";

export function itemsRoutes(dataDir: string, homebrewDb: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(list, (c) => {
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const catalog = listItems(dataDir, edition).map(toItemRecord);
    const homebrew = listHomebrewItems(homebrewDb)
      .filter((row) => row.edition === edition)
      .map(toHomebrewItemRecord);
    const merged = [...catalog, ...homebrew].sort((a, b) => a.name.localeCompare(b.name));
    return c.json({
      items: merged.slice(offset, offset + limit),
      total: merged.length,
      limit,
      offset,
    });
  });

  routes.openapi(read, (c) => {
    const { name, source } = c.req.valid("param");
    const row = getItem(dataDir, name, source);
    if (!row) return c.json({ error: ITEM_NOT_FOUND }, 404);
    return c.json(toItemRecord(row), 200);
  });

  routes.openapi(expand, (c) => {
    const { name, source, variantName, variantSource } = c.req.valid("param");
    const row = getExpandedItem(
      dataDir,
      { name, source },
      { name: variantName, source: variantSource },
    );
    if (row === undefined) return c.json({ error: VARIANT_NOT_FOUND }, 404);
    if (row === null) return c.json({ error: VARIANT_REFUSED }, 409);
    return c.json(toItemRecord(row), 200);
  });

  return routes;
}
