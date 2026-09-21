/**
 * Reads the spell catalog: `content.db`'s `spells` table merged, at query time, with
 * `homebrew.db`'s homebrew spells of the same edition. A homebrew row carries no
 * `source` at the top level and a catalog row carries no `id` — that structural
 * difference is how a caller tells the two apart, without inspecting `source`.
 *
 * Creating, renaming or deleting a homebrew spell stays with `/homebrew/spells`; this
 * only reads.
 */
import {
  type HomebrewSpellRecord,
  homebrewSpellRecordSchema,
  type SpellRecord,
  spellRecordSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getSpell, listSpells, type SpellRow } from "../db/queries/content.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { listHomebrewSpells } from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";

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
    404: notFound("spell"),
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
    const boundedLimit = Math.min(limit, MAX_LIMIT);
    return c.json({
      items: merged.slice(offset, offset + boundedLimit),
      total: merged.length,
      limit: boundedLimit,
      offset,
    });
  });

  routes.openapi(read, (c) => {
    const { name, source } = c.req.valid("param");
    const row = getSpell(dataDir, name, source);
    if (!row) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.json(toSpellRecord(row), 200);
  });

  return routes;
}
