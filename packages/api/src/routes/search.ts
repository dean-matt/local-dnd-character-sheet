/**
 * Searches the catalog and homebrew together: Tier A's flat-keyed tables, Tier C's
 * `entities`, and `homebrew.db`'s items and spells, merged into one list ranked by
 * `compareSearchHits`, and lists the sources such a search can leave out.
 * See `packages/api/src/db/queries/catalog-search.ts`'s `searchCatalog` for what each tier's
 * query can and cannot do, and its `CATALOG_SEARCH_TABLES` for what a Tier A `type` can
 * be — a Tier C hit's `type` is open, since `packages/content` loads one for every array
 * key a data file contributes.
 */
import {
  catalogSearchHitSchema,
  compareSearchHits,
  homebrewSearchHitSchema,
  type SearchHit,
  searchResponseSchema,
  searchSourcesResponseSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  type CatalogSearchRow,
  listSearchSources,
  searchCatalog,
} from "../db/queries/catalog-search.ts";
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
  exclude: z.string().optional().openapi({
    description: "Comma-separated source abbreviations whose catalog rows to leave out",
    example: "VGM,SCAG",
  }),
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

/** Unbounded, like `/catalog/sources`: upstream cites a few hundred sources, not thousands. */
const sources = createRoute({
  method: "get",
  path: "/search/sources",
  tags: ["search"],
  summary: "Every source a search can return a catalog row from",
  responses: {
    200: {
      description: "Each source abbreviation, sorted",
      content: { "application/json": { schema: searchSourcesResponseSchema } },
    },
  },
});

export function searchRoutes(dataDir: string, homebrewDb: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(search, (c) => {
    const { edition, q, type, limit = DEFAULT_LIMIT, offset = 0, exclude } = c.req.valid("query");

    const excluded = new Set(exclude?.split(","));
    const catalogHits = searchCatalog(dataDir, edition, q, type)
      .filter((row) => !excluded.has(row.source))
      .map(toHit);
    const homebrewItemHits =
      type === undefined || type === "item"
        ? searchHomebrewItems(homebrewDb, edition, q).map(toHomebrewItemHit)
        : [];
    const homebrewSpellHits =
      type === undefined || type === "spell"
        ? searchHomebrewSpells(homebrewDb, edition, q).map(toHomebrewSpellHit)
        : [];

    const merged = [...catalogHits, ...homebrewItemHits, ...homebrewSpellHits].sort(
      compareSearchHits(q),
    );

    return c.json({
      items: merged.slice(offset, offset + limit),
      total: merged.length,
      limit,
      offset,
    });
  });

  routes.openapi(sources, (c) => c.json({ sources: listSearchSources(dataDir) }, 200));

  return routes;
}
