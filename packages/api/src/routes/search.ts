/**
 * Searches the catalog and homebrew together: Tier A's flat-keyed tables, Tier C's
 * `entities`, and `homebrew.db`'s items and spells, merged into one list ordered by name.
 * See `packages/api/src/db/queries/content.ts`'s `searchCatalog` for what each tier's
 * query can and cannot do, and its `CATALOG_SEARCH_TABLES` for what a Tier A `type` can
 * be — a Tier C hit's `type` is open, since `packages/content` loads one for every array
 * key a data file contributes.
 */
import {
  catalogSearchHitSchema,
  homebrewSearchHitSchema,
  type SearchHit,
  searchHitSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type CatalogSearchRow, searchCatalog } from "../db/queries/content.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { searchHomebrewItems, searchHomebrewSpells } from "../db/queries/homebrew.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toHit(row: CatalogSearchRow): SearchHit {
  return catalogSearchHitSchema.parse(row);
}

type HomebrewItemRow = ReturnType<typeof searchHomebrewItems>[number];
type HomebrewSpellRow = ReturnType<typeof searchHomebrewSpells>[number];

function toHomebrewItemHit(row: HomebrewItemRow): SearchHit {
  return homebrewSearchHitSchema.parse({
    type: "item",
    id: row.id,
    name: row.name,
    edition: row.edition,
  });
}

function toHomebrewSpellHit(row: HomebrewSpellRow): SearchHit {
  return homebrewSearchHitSchema.parse({
    type: "spell",
    id: row.id,
    name: row.name,
    edition: row.edition,
  });
}

const listQuery = z.object({
  edition: z.enum(EDITIONS),
  q: z.string().trim().min(1),
  type: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const searchResponseSchema = z.object({
  items: z.array(searchHitSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const search = createRoute({
  method: "get",
  path: "/search",
  tags: ["search"],
  summary: "Search the catalog and homebrew together, one ranked list",
  request: { query: listQuery },
  responses: {
    200: {
      description: "A page of hits, bounded by limit and offset",
      content: { "application/json": { schema: searchResponseSchema } },
    },
  },
});

export function searchRoutes(dataDir: string, homebrewDb: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(search, (c) => {
    const { edition, q, type, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");

    const catalogHits = searchCatalog(dataDir, edition, q, type).map(toHit);
    const homebrewItemHits =
      type === undefined || type === "item"
        ? searchHomebrewItems(homebrewDb, edition, q).map(toHomebrewItemHit)
        : [];
    const homebrewSpellHits =
      type === undefined || type === "spell"
        ? searchHomebrewSpells(homebrewDb, edition, q).map(toHomebrewSpellHit)
        : [];

    const merged = [...catalogHits, ...homebrewItemHits, ...homebrewSpellHits].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return c.json({
      items: merged.slice(offset, offset + limit),
      total: merged.length,
      limit,
      offset,
    });
  });

  return routes;
}
