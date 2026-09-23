/**
 * Reads `content.db`'s `races` and `subraces` tables. A subrace is nested under its race
 * — `/races/{raceName}/{raceSource}/subraces` — because its identity is `(name, source,
 * race_name, race_source)`, not `(name, source)` alone; see docs/data-model.md. Its row
 * is already the race merged with the subrace, not a delta this route applies.
 *
 * Homebrew races live in `homebrew.db` but are not merged in here — that merge is
 * separate work, the way it was for items, spells, backgrounds and feats. Creating,
 * renaming or deleting one stays with `/homebrew/races`.
 */
import {
  type RaceRecord,
  raceRecordSchema,
  type SubraceRecord,
  subraceRecordSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  getRace,
  getSubrace,
  listRaces,
  listSubraces,
  type RaceRow,
  type SubraceRow,
} from "../db/queries/content.ts";
import { notFound } from "./errors.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toRaceRecord(row: RaceRow): RaceRecord {
  return raceRecordSchema.parse({ ...row, json: JSON.parse(row.json) });
}

function toSubraceRecord(row: SubraceRow): SubraceRecord {
  return subraceRecordSchema.parse({
    name: row.name,
    source: row.source,
    raceName: row.race_name,
    raceSource: row.race_source,
    edition: row.edition,
    json: JSON.parse(row.json),
  });
}

const listQuery = z.object({
  edition: z.enum(EDITIONS),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const raceListResponseSchema = z.object({
  items: z.array(raceRecordSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const listRacesRoute = createRoute({
  method: "get",
  path: "/races",
  tags: ["races"],
  summary: "List races of one edition",
  request: { query: listQuery },
  responses: {
    200: {
      description: "A page of races, bounded by limit and offset",
      content: { "application/json": { schema: raceListResponseSchema } },
    },
  },
});

const nameSourceParam = z.object({ name: z.string(), source: z.string() });

const readRace = createRoute({
  method: "get",
  path: "/races/{name}/{source}",
  tags: ["races"],
  summary: "Read one race by name and source",
  request: { params: nameSourceParam },
  responses: {
    200: {
      description: "The race",
      content: { "application/json": { schema: raceRecordSchema } },
    },
    404: notFound("race", "name and source"),
  },
});

const raceParam = z.object({ raceName: z.string(), raceSource: z.string() });

const subraceListResponseSchema = z.object({
  items: z.array(subraceRecordSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const listSubracesRoute = createRoute({
  method: "get",
  path: "/races/{raceName}/{raceSource}/subraces",
  tags: ["races"],
  summary: "List the subraces of one race, of one edition",
  request: { params: raceParam, query: listQuery },
  responses: {
    200: {
      description: "A page of subraces, bounded by limit and offset",
      content: { "application/json": { schema: subraceListResponseSchema } },
    },
  },
});

const subraceParam = z.object({
  raceName: z.string(),
  raceSource: z.string(),
  name: z.string(),
  source: z.string(),
});

const readSubrace = createRoute({
  method: "get",
  path: "/races/{raceName}/{raceSource}/subraces/{name}/{source}",
  tags: ["races"],
  summary: "Read one subrace by its own name and source and its race's",
  request: { params: subraceParam },
  responses: {
    200: {
      description: "The subrace, merged with its race",
      content: { "application/json": { schema: subraceRecordSchema } },
    },
    404: notFound("subrace", "name, source, race name and race source"),
  },
});

const RACE_NOT_FOUND = "No race with that name and source";
const SUBRACE_NOT_FOUND = "No subrace with that name, source, race name and race source";

export function racesRoutes(dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(listRacesRoute, (c) => {
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const races = listRaces(dataDir, edition).map(toRaceRecord);
    return c.json({
      items: races.slice(offset, offset + limit),
      total: races.length,
      limit,
      offset,
    });
  });

  routes.openapi(readRace, (c) => {
    const { name, source } = c.req.valid("param");
    const row = getRace(dataDir, name, source);
    if (!row) return c.json({ error: RACE_NOT_FOUND }, 404);
    return c.json(toRaceRecord(row), 200);
  });

  routes.openapi(listSubracesRoute, (c) => {
    const { raceName, raceSource } = c.req.valid("param");
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const subraces = listSubraces(dataDir, raceName, raceSource, edition).map(toSubraceRecord);
    return c.json({
      items: subraces.slice(offset, offset + limit),
      total: subraces.length,
      limit,
      offset,
    });
  });

  routes.openapi(readSubrace, (c) => {
    const { raceName, raceSource, name, source } = c.req.valid("param");
    const row = getSubrace(dataDir, name, source, raceName, raceSource);
    if (!row) return c.json({ error: SUBRACE_NOT_FOUND }, 404);
    return c.json(toSubraceRecord(row), 200);
  });

  return routes;
}
