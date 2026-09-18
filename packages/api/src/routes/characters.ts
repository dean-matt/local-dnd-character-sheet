/**
 * List, read, create, update and delete for `characters.db`'s `characters` table.
 * `name`, `level` and `edition` are never accepted from a request body — the query
 * layer derives all three from `definition` on every write.
 */
import { randomUUID } from "node:crypto";
import {
  type CharacterRecord,
  characterDefinitionSchema,
  characterRecordSchema,
} from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import {
  deleteCharacter,
  getCharacter,
  insertCharacter,
  listCharacters,
  updateCharacterDefinition,
} from "../db/queries/characters.ts";
import { notFound } from "./errors.ts";

type CharacterRow = NonNullable<ReturnType<typeof getCharacter>>;

/** Validates a row read back from SQLite against the same schema its write went through. */
function toRecord(row: CharacterRow): CharacterRecord {
  return characterRecordSchema.parse({
    id: row.id,
    name: row.name,
    edition: row.edition,
    level: row.level,
    definition: row.definition,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

const idParam = z.object({ id: z.string() });

const NOT_FOUND = "no character with that id";

const list = createRoute({
  method: "get",
  path: "/characters",
  tags: ["characters"],
  summary: "List every character",
  responses: {
    200: {
      description: "Every character",
      content: { "application/json": { schema: z.array(characterRecordSchema) } },
    },
  },
});

const read = createRoute({
  method: "get",
  path: "/characters/{id}",
  tags: ["characters"],
  summary: "Read one character",
  request: { params: idParam },
  responses: {
    200: {
      description: "The character",
      content: { "application/json": { schema: characterRecordSchema } },
    },
    404: notFound("character"),
  },
});

const create = createRoute({
  method: "post",
  path: "/characters",
  tags: ["characters"],
  summary: "Create a character",
  request: {
    body: { content: { "application/json": { schema: characterDefinitionSchema } } },
  },
  responses: {
    201: {
      description: "The created character",
      content: { "application/json": { schema: characterRecordSchema } },
    },
  },
});

const update = createRoute({
  method: "put",
  path: "/characters/{id}",
  tags: ["characters"],
  summary: "Replace a character's definition",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: characterDefinitionSchema } } },
  },
  responses: {
    200: {
      description: "The updated character",
      content: { "application/json": { schema: characterRecordSchema } },
    },
    404: notFound("character"),
  },
});

const remove = createRoute({
  method: "delete",
  path: "/characters/{id}",
  tags: ["characters"],
  summary: "Delete a character",
  request: { params: idParam },
  responses: {
    204: { description: "The character was deleted" },
    404: notFound("character"),
  },
});

export function charactersRoutes(db: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(list, (c) => c.json(listCharacters(db).map(toRecord)));

  routes.openapi(read, (c) => {
    const row = getCharacter(db, c.req.valid("param").id);
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toRecord(row), 200);
  });

  routes.openapi(create, (c) => {
    const row = insertCharacter(db, { id: randomUUID(), definition: c.req.valid("json") });
    return c.json(toRecord(row), 201);
  });

  routes.openapi(update, (c) => {
    const { id } = c.req.valid("param");
    const row = updateCharacterDefinition(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toRecord(row), 200);
  });

  routes.openapi(remove, (c) => {
    const { id } = c.req.valid("param");
    if (!deleteCharacter(db, id)) return c.json({ error: NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
