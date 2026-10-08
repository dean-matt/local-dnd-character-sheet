/**
 * Searches the catalog and homebrew together: Tier A's tables, Tier B's rules lookups, Tier
 * C's `entities`, and `homebrew.db`'s items and spells, merged into one list ranked by
 * `compareSearchHits`, and lists the sources such a search can leave out and the types it
 * can return.
 * See `packages/api/src/db/queries/catalog-search.ts`'s `searchCatalog` for what each tier's
 * query can and cannot do, and its `CATALOG_SEARCH_TABLES` for what a Tier A `type` can
 * be — a Tier C hit's `type` is open, since `packages/content` loads one for every array
 * key a data file contributes.
 */
import {
  catalogSearchHitSchema,
  compareSearchHits,
  homebrewSearchHitSchema,
  ITEM_KINDS,
  itemHitFacts,
  type SearchHit,
  searchResponseSchema,
  searchSourcesResponseSchema,
  searchTypesResponseSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  type CatalogSearchRow,
  listSearchSources,
  listSearchTypes,
  type SearchFilter,
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
    item: itemHitFacts(row.json),
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

const csv = (description: string, example: string) =>
  z.string().optional().openapi({ description, example });

const spellLevel = z.coerce.number().int().min(0).max(9).optional();

/** A `Name|Source` parameter as the reference it spells, `undefined` where absent. */
function nameSource(param: string | undefined) {
  if (param === undefined) return undefined;
  const at = param.lastIndexOf("|");
  return { name: param.slice(0, at), source: param.slice(at + 1) };
}

const refParam = (description: string, example: string) =>
  z
    .string()
    .regex(/^[^|]+\|[^|]+$/, "Must be Name|Source")
    .optional()
    .openapi({ description, example });

/** A comma-separated parameter's values, or `undefined` where it names none. */
function list(param: string | undefined): string[] | undefined {
  const values = param?.split(",").filter((value) => value !== "");
  return values?.length ? values : undefined;
}

const listQuery = z.object({
  edition: z.enum(EDITIONS).optional().openapi({
    description: "The ruleset to read; absent reads both. A row with no edition matches either",
  }),
  q: z.string().trim().optional().openapi({
    description: "A name to search for; absent or blank lists every row the filters admit",
  }),
  type: csv("Comma-separated kinds of row to read; absent reads every kind", "spell,item"),
  source: csv("Comma-separated source abbreviations to narrow catalog rows to", "PHB,XGE"),
  minLevel: spellLevel.openapi({ description: "The lowest spell level to read" }),
  maxLevel: spellLevel.openapi({ description: "The highest spell level to read" }),
  school: csv("Comma-separated spell school codes to narrow spells to", "V,A"),
  rarity: csv("Comma-separated rarities to narrow items to", "rare,very rare"),
  kind: z
    .string()
    .optional()
    .refine((value) => list(value)?.every((kind) => ITEM_KINDS.some((k) => k === kind)) ?? true, {
      message: `Each kind must be one of ${ITEM_KINDS.join(", ")}`,
    })
    .openapi({
      description: `Comma-separated kinds of item to narrow items to, of ${ITEM_KINDS.join(", ")}`,
      example: "melee,ranged",
    }),
  class: refParam("A class, as Name|Source, whose spell list to narrow spells to", "Wizard|XPHB"),
  subclass: refParam(
    "A subclass of that class, as Name|Source, whose added spells widen the list; ignored without class",
    "Eldritch Knight|XPHB",
  ),
  classLevel: z.coerce.number().int().min(1).max(20).optional().openapi({
    description: "The class level a subclass's added spells are read at; absent reads every level",
  }),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  exclude: csv("Comma-separated source abbreviations whose catalog rows to leave out", "VGM,SCAG"),
});

/** The spell levels from `a` to `b`, read the right way round when written backwards. */
const levelRange = (a: number, b: number) => ({ min: Math.min(a, b), max: Math.max(a, b) });

const search = createRoute({
  method: "get",
  path: "/search",
  tags: ["search"],
  summary: "Search the catalog and homebrew together, one ranked list",
  description:
    "minLevel, maxLevel and school narrow spells alone, and rarity and kind items alone, passing every other kind through. " +
    "A source narrows to catalog rows, so it leaves homebrew out.",
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

const types = createRoute({
  method: "get",
  path: "/search/types",
  tags: ["search"],
  summary: "Every kind of row a search can return",
  responses: {
    200: {
      description: "Each type, sorted",
      content: { "application/json": { schema: searchTypesResponseSchema } },
    },
  },
});

export function searchRoutes(dataDir: string, homebrewDb: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(search, (c) => {
    const query = c.req.valid("query");
    const { limit = DEFAULT_LIMIT, offset = 0 } = query;
    const term = query.q ?? "";
    const typeList = list(query.type);
    const narrowTo = list(query.source);
    const cls = nameSource(query.class);
    const subclass = nameSource(query.subclass);
    const filter: SearchFilter = {
      edition: query.edition,
      term,
      types: typeList,
      schools: list(query.school),
      rarities: list(query.rarity),
      itemKinds: list(query.kind),
      spellLevels:
        query.minLevel === undefined && query.maxLevel === undefined
          ? undefined
          : levelRange(query.minLevel ?? 0, query.maxLevel ?? 9),
      ...(cls && {
        classList: {
          class: cls,
          ...(subclass && { subclass }),
          ...(query.classLevel && { level: query.classLevel }),
        },
      }),
    };
    const reads = (type: string) => typeList === undefined || typeList.includes(type);

    const excluded = new Set(list(query.exclude));
    const catalogHits = searchCatalog(dataDir, filter)
      .filter((row) => !excluded.has(row.source) && (!narrowTo || narrowTo.includes(row.source)))
      .map(toHit);
    const homebrewItemHits =
      !narrowTo && reads("item")
        ? searchHomebrewItems(homebrewDb, filter).map(toHomebrewItemHit)
        : [];
    const homebrewSpellHits =
      !narrowTo && !cls && reads("spell")
        ? searchHomebrewSpells(homebrewDb, filter).map(toHomebrewSpellHit)
        : [];

    const merged = [...catalogHits, ...homebrewItemHits, ...homebrewSpellHits].sort(
      compareSearchHits(term),
    );

    return c.json({
      items: merged.slice(offset, offset + limit),
      total: merged.length,
      limit,
      offset,
    });
  });

  routes.openapi(sources, (c) => c.json({ sources: listSearchSources(dataDir) }, 200));

  routes.openapi(types, (c) => c.json({ types: listSearchTypes(dataDir) }, 200));

  return routes;
}
