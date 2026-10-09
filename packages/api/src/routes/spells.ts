/**
 * Reads the spell catalog: `content.db`'s `spells` table merged, at query time, with
 * `homebrew.db`'s homebrew spells of the same edition. A homebrew row carries no
 * `source` at the top level and a catalog row carries no `id` — that structural
 * difference is how a caller tells the two apart, without inspecting `source`.
 *
 * Creating, renaming or deleting a homebrew spell stays with `/homebrew/spells`; this
 * only reads. It also answers what choosing spells needs beside the picker: what a grantor
 * gives outright by a level, and where each spell picked sits.
 */
import {
  grantedSpellsSchema,
  type HomebrewSpellRecord,
  homebrewSpellRecordSchema,
  SPELL_GRANTORS,
  type SpellLookup,
  type SpellRecord,
  spellLookupRequestSchema,
  spellLookupResponseSchema,
  spellRecordSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { getHomebrewSpell, listHomebrewSpells } from "../db/queries/homebrew.ts";
import {
  getGrantedSpells,
  getSpell,
  listSpells,
  lookupCatalogSpells,
  type SpellRow,
} from "../db/queries/spells.ts";
import { catalogOutOfDate, notFound } from "./errors.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toSpellRecord(row: SpellRow): SpellRecord {
  return spellRecordSchema.parse({
    ...row,
    concentration: row.concentration === 1,
    ritual: row.ritual === 1,
    json: JSON.parse(row.json),
  });
}

type HomebrewSpellRow = ReturnType<typeof listHomebrewSpells>[number];

function toHomebrewSpellRecord(row: HomebrewSpellRow): HomebrewSpellRecord {
  return homebrewSpellRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

const spellUnionSchema = z.union([spellRecordSchema, homebrewSpellRecordSchema]);

const listQuery = z.object({
  edition: z.enum(EDITIONS),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const spellListResponseSchema = z.object({
  items: z.array(spellUnionSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const list = createRoute({
  method: "get",
  path: "/spells",
  tags: ["spells"],
  summary: "List spells of one edition, catalog and homebrew merged",
  request: { query: listQuery },
  responses: {
    200: {
      description: "A page of spells, bounded by limit and offset",
      content: { "application/json": { schema: spellListResponseSchema } },
    },
    503: catalogOutOfDate,
  },
});

const nameSourceParam = z.object({ name: z.string(), source: z.string() });

const read = createRoute({
  method: "get",
  path: "/spells/{name}/{source}",
  tags: ["spells"],
  summary: "Read one catalog spell by name and source",
  request: { params: nameSourceParam },
  responses: {
    200: {
      description: "The spell",
      content: { "application/json": { schema: spellRecordSchema } },
    },
    404: notFound("spell", "name and source"),
    503: catalogOutOfDate,
  },
});

const grantedQuery = z.object({
  grantor: z.enum(SPELL_GRANTORS),
  name: z.string().min(1),
  source: z.string().min(1),
  parentName: z.string().min(1).optional().openapi({
    description: "A subclass's class or a subrace's race, which the grantor's key carries",
  }),
  parentSource: z.string().min(1).optional(),
  level: z.coerce.number().int().min(1).max(20).openapi({
    description: "The class level for a class or subclass, the character level for the rest",
  }),
});

const granted = createRoute({
  method: "get",
  path: "/spells/granted",
  tags: ["spells"],
  summary: "List the spells one grantor gives outright by a level",
  description:
    "A spell the grantor leaves to the player's pick stays out. A grantor no row answers gives nothing, not a 404.",
  request: { query: grantedQuery },
  responses: {
    200: {
      description: "The spells given, sorted by name, and the picks the grantor offers",
      content: { "application/json": { schema: grantedSpellsSchema } },
    },
    503: catalogOutOfDate,
  },
});

const lookup = createRoute({
  method: "post",
  path: "/spells/lookup",
  tags: ["spells"],
  summary: "Read each spell's name and level, and whether a class's list holds it, in order",
  description:
    "A POST because the batch is a body a query string would have to encode; it writes nothing.",
  request: {
    body: { required: true, content: { "application/json": { schema: spellLookupRequestSchema } } },
  },
  responses: {
    200: {
      description: "Each spell's level and standing, or null where no row answers",
      content: { "application/json": { schema: spellLookupResponseSchema } },
    },
    503: catalogOutOfDate,
  },
});

const SPELL_NOT_FOUND = "No spell with that name and source";

export function spellsRoutes(dataDir: string, homebrewDb: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(list, (c) => {
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const catalog = listSpells(dataDir, edition).map(toSpellRecord);
    const homebrew = listHomebrewSpells(homebrewDb)
      .filter((row) => row.edition === edition)
      .map(toHomebrewSpellRecord);
    const merged = [...catalog, ...homebrew].sort((a, b) => a.name.localeCompare(b.name));
    return c.json(
      {
        items: merged.slice(offset, offset + limit),
        total: merged.length,
        limit,
        offset,
      },
      200,
    );
  });

  routes.openapi(granted, (c) => {
    const { grantor, name, source, parentName, parentSource, level } = c.req.valid("query");
    const parent =
      parentName && parentSource ? { parent: { name: parentName, source: parentSource } } : {};
    return c.json(
      getGrantedSpells(dataDir, { kind: grantor, name, source, ...parent }, level),
      200,
    );
  });

  routes.openapi(lookup, (c) => {
    const { spells, list } = c.req.valid("json");
    const catalog = lookupCatalogSpells(
      dataDir,
      spells.flatMap((ref) => ("homebrewId" in ref ? [] : [ref])),
      list,
    ).values();
    const looked: (SpellLookup | null)[] = spells.map((ref) => {
      if (!("homebrewId" in ref)) return catalog.next().value ?? null;
      const row = getHomebrewSpell(homebrewDb, ref.homebrewId);
      if (!row) return null;
      return { name: row.name, level: row.level, ...(list && { listed: false }) };
    });
    return c.json({ spells: looked }, 200);
  });

  routes.openapi(read, (c) => {
    const { name, source } = c.req.valid("param");
    const row = getSpell(dataDir, name, source);
    if (!row) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.json(toSpellRecord(row), 200);
  });

  return routes;
}
