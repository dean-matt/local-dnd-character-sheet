/**
 * List, read, create, duplicate, update and delete for `characters.db`'s `characters` table, plus
 * read and replace for the `character_state` row each one owns, and the undo log a
 * definition update writes. `name`, `level`,
 * `edition`, `raceSummary` and `classSummary` are never accepted from a request body —
 * the query layer derives all five from `definition` on every write, and a state write
 * never reaches that table. A delete runs `backup` first and deletes nothing where it
 * throws, since that snapshot is the only way back.
 */
import { randomUUID } from "node:crypto";
import {
  type CharacterRecord,
  type CharacterStateRecord,
  characterDefinitionSchema,
  characterRecordSchema,
  characterStateRecordSchema,
  characterStateSchema,
  UNDO_LOG_LIMIT,
  undoLogSchema,
} from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import {
  deleteCharacter,
  duplicateCharacter,
  getCharacter,
  getCharacterState,
  insertCharacter,
  listCharacters,
  undoLastChange,
  updateCharacterDefinition,
  updateCharacterState,
} from "../db/queries/characters.ts";
import { listUndoEntries } from "../db/queries/undo.ts";
import { errorSchema, notFound } from "./errors.ts";

type CharacterRow = NonNullable<ReturnType<typeof getCharacter>>;
type CharacterStateRow = NonNullable<ReturnType<typeof getCharacterState>>;

/** Validates a row read back from SQLite against the same schema its write went through. */
function toRecord(row: CharacterRow): CharacterRecord {
  return characterRecordSchema.parse({
    id: row.id,
    name: row.name,
    edition: row.edition,
    level: row.level,
    raceSummary: row.raceSummary,
    classSummary: row.classSummary,
    definition: row.definition,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/** Validates a row read back from SQLite against the same schema its write went through. */
function toStateRecord(row: CharacterStateRow): CharacterStateRecord {
  return characterStateRecordSchema.parse({
    characterId: row.characterId,
    state: row.state,
    updatedAt: row.updatedAt.toISOString(),
  });
}

const idParam = z.object({ id: z.string() });

const NOT_FOUND = "No character with that id";

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

const duplicate = createRoute({
  method: "post",
  path: "/characters/{id}/duplicate",
  tags: ["characters"],
  summary: "Duplicate a character",
  description:
    'Copies the definition and pages under a new id, with " (copy)" after the name. ' +
    "The copy starts with the default state and empty roll and undo logs.",
  request: { params: idParam },
  responses: {
    201: {
      description: "The copy",
      content: { "application/json": { schema: characterRecordSchema } },
    },
    404: notFound("character"),
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
  description:
    "Deletes the character with its state, pages, roll log and undo log, after a " +
    "snapshot of `characters.db` lands in `data/backups/`. Undo does not reach a " +
    "deleted character; the snapshot is the only way back.",
  request: { params: idParam },
  responses: {
    204: { description: "The character was deleted" },
    404: notFound("character"),
    500: {
      description: "The snapshot failed, so nothing was deleted",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const readState = createRoute({
  method: "get",
  path: "/characters/{id}/state",
  tags: ["characters"],
  summary: "Read a character's state",
  request: { params: idParam },
  responses: {
    200: {
      description: "The character's state",
      content: { "application/json": { schema: characterStateRecordSchema } },
    },
    404: notFound("character"),
  },
});

const writeState = createRoute({
  method: "put",
  path: "/characters/{id}/state",
  tags: ["characters"],
  summary: "Replace a character's state",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: characterStateSchema } } },
  },
  responses: {
    200: {
      description: "The updated state",
      content: { "application/json": { schema: characterStateRecordSchema } },
    },
    404: notFound("character"),
  },
});

const readUndo = createRoute({
  method: "get",
  path: "/characters/{id}/undo",
  tags: ["characters"],
  summary: "List a character's undo entries, newest first",
  description:
    "Each `PUT /characters/{id}` records the definition it replaced, merging an autosave " +
    "burst on one field into one entry. The log covers the definition only — not state, " +
    `pages or a deleted character — and keeps the newest ${UNDO_LOG_LIMIT}.`,
  request: { params: idParam },
  responses: {
    200: {
      description: "What each undo would restore, the next one first",
      content: { "application/json": { schema: undoLogSchema } },
    },
    404: notFound("character"),
  },
});

const undo = createRoute({
  method: "post",
  path: "/characters/{id}/undo",
  tags: ["characters"],
  summary: "Restore the definition the newest undo entry holds, and drop the entry",
  request: { params: idParam },
  responses: {
    200: {
      description: "The character as restored",
      content: { "application/json": { schema: characterRecordSchema } },
    },
    404: notFound("character"),
    409: {
      description: "Nothing left to undo",
      content: { "application/json": { schema: errorSchema } },
    },
    422: {
      description:
        "The entry's snapshot no longer passes the schema, so the entry is dropped " +
        "and the definition left as it was",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export function charactersRoutes(db: CharactersDb, backup: () => void) {
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

  routes.openapi(duplicate, (c) => {
    const row = duplicateCharacter(db, c.req.valid("param").id, randomUUID());
    if (!row) return c.json({ error: NOT_FOUND }, 404);
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
    if (!getCharacter(db, id)) return c.json({ error: NOT_FOUND }, 404);
    try {
      backup();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return c.json(
        { error: `Could not back up characters.db, so nothing was deleted: ${reason}` },
        500,
      );
    }
    deleteCharacter(db, id);
    return c.body(null, 204);
  });

  routes.openapi(readState, (c) => {
    const row = getCharacterState(db, c.req.valid("param").id);
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toStateRecord(row), 200);
  });

  routes.openapi(writeState, (c) => {
    const { id } = c.req.valid("param");
    const row = updateCharacterState(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toStateRecord(row), 200);
  });

  routes.openapi(readUndo, (c) => {
    const { id } = c.req.valid("param");
    if (!getCharacter(db, id)) return c.json({ error: NOT_FOUND }, 404);
    const entries = listUndoEntries(db, id).map((entry) => ({
      ...entry,
      changedAt: entry.changedAt.toISOString(),
    }));
    return c.json(undoLogSchema.parse(entries), 200);
  });

  routes.openapi(undo, (c) => {
    const result = undoLastChange(db, c.req.valid("param").id);
    if (!result) return c.json({ error: NOT_FOUND }, 404);
    if (result.kind === "empty") return c.json({ error: "Nothing to undo" }, 409);
    if (result.kind === "invalid") return c.json({ error: result.message }, 422);
    return c.json(toRecord(result.row), 200);
  });

  return routes;
}
