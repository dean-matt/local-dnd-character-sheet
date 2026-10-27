/**
 * List, read, create, duplicate, import, export, update and delete for `characters.db`'s
 * `characters` table, plus read and replace for the `character_state` row each one owns,
 * and the undo log a definition update writes. `name`, `level`, `edition`, `raceSummary`
 * and `classSummary` are never accepted from a request body —
 * the query layer derives all five from `definition` on every write, and a state write
 * never reaches that table. A delete runs `backup` first and deletes nothing where it
 * throws, since that snapshot is the only way back.
 */
import { randomUUID } from "node:crypto";
import {
  type CharacterFile,
  type CharacterRecord,
  type CharacterStateRecord,
  carriesCustomSkills,
  characterDefinitionSchema,
  characterFileSchema,
  characterRecordSchema,
  characterStateRecordSchema,
  characterStateSchema,
  type LegacyCharacterFile,
  legacyCharacterFileSchema,
  UNDO_LOG_LIMIT,
  undoLogSchema,
  withExperienceFloor,
} from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type Database from "better-sqlite3";
import { importWithCustomSkills } from "../db/convertCustomSkills.ts";
import type { CharactersDb } from "../db/queries/characters.ts";
import {
  deleteCharacter,
  duplicateCharacter,
  getCharacter,
  getCharacterState,
  importCharacter,
  insertCharacter,
  listCharacters,
  undoChanges,
  updateCharacterDefinition,
  updateCharacterState,
} from "../db/queries/characters.ts";
import { listCharacterPages } from "../db/queries/pages.ts";
import { listUndoEntries } from "../db/queries/undo.ts";
import { errorSchema, notFound } from "./errors.ts";
import { toPageRecords } from "./pages.ts";

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
    definition: withExperienceFloor(characterDefinitionSchema.parse(row.definition)),
    portraitUpdatedAt: row.portraitUpdatedAt?.toISOString() ?? null,
    hasPreviousPortrait: row.hasPreviousPortrait,
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

const exportFile = createRoute({
  method: "get",
  path: "/characters/{id}/export",
  tags: ["characters"],
  summary: "Export a character as one file",
  description:
    "The definition, state and pages, with every catalog and homebrew reference as " +
    "stored. The roll and undo logs stay behind.",
  request: { params: idParam },
  responses: {
    200: {
      description: "The character file",
      content: { "application/json": { schema: characterFileSchema } },
    },
    404: notFound("character"),
  },
});

/** A file exported while characters kept `customSkills` still imports, converted as the startup conversion does. */
const importSchema = z.union([characterFileSchema, legacyCharacterFileSchema]);

const isLegacy = (file: z.infer<typeof importSchema>): file is LegacyCharacterFile =>
  carriesCustomSkills(file.definition);

const importFile = createRoute({
  method: "post",
  path: "/characters/import",
  tags: ["characters"],
  summary: "Import a character file as a new character",
  description:
    "Always creates a character under a new id. A reference that resolves to nothing " +
    "here imports as written.",
  request: {
    body: { content: { "application/json": { schema: importSchema } } },
  },
  responses: {
    201: {
      description: "The imported character",
      content: { "application/json": { schema: characterRecordSchema } },
    },
    422: {
      description: "The file fails the schema, so nothing was written",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

/** A union fails with one issue per branch; the branch nearest to matching is the one worth naming. */
function flattenIssues(issues: readonly z.core.$ZodIssue[]): z.core.$ZodIssue[] {
  return issues.flatMap((issue) => {
    if (issue.code !== "invalid_union") return [issue];
    const nearest = issue.errors.reduce((best, each) => (each.length < best.length ? each : best));
    return flattenIssues(nearest);
  });
}

/** Names each field a file fails on, so the person importing it can find the field. */
function describeIssues(error: z.ZodError): string {
  const issues = flattenIssues(error.issues).map(
    (issue) => `${issue.path.join(".") || "file"}: ${issue.message}`,
  );
  return `Not a character file this build can read. ${issues.join("; ")}`;
}

// RFC 9110 has a server ignore a date it cannot parse; a 400 instead keeps a malformed
// precondition from writing unguarded.
const ifUnmodifiedSince = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "not an HTTP date")
  .optional();

const update = createRoute({
  method: "put",
  path: "/characters/{id}",
  tags: ["characters"],
  summary: "Replace a character's definition",
  description:
    "With `If-Unmodified-Since` set to the `updatedAt` the client last read, refuses " +
    "with 412 where the character was written since. `updatedAt` holds whole seconds, " +
    "so a write within the same second passes. A write landing within 30 seconds of the " +
    "newest undo entry, on the same fields, merges into it; `Undo-Entry: own` makes the " +
    "write an entry of its own that no later write merges into.",
  request: {
    params: idParam,
    headers: z.object({
      "if-unmodified-since": ifUnmodifiedSince,
      "undo-entry": z.literal("own").optional(),
    }),
    body: { content: { "application/json": { schema: characterDefinitionSchema } } },
  },
  responses: {
    200: {
      description: "The updated character",
      content: { "application/json": { schema: characterRecordSchema } },
    },
    404: notFound("character"),
    412: {
      description: "The character was written after `If-Unmodified-Since`, so nothing was written",
      content: { "application/json": { schema: errorSchema } },
    },
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
  summary: "Restore the definition an undo entry holds, and drop it and every newer entry",
  description:
    "Undoes back to `to`, or the newest entry alone where the body names none, in one " +
    "write. `newest` is the head of the log the client read, and `If-Unmodified-Since` " +
    "the character's `updatedAt`: where either has moved on, nothing is written.",
  request: {
    params: idParam,
    headers: z.object({ "if-unmodified-since": ifUnmodifiedSince }),
    body: {
      required: false,
      content: {
        "application/json": {
          schema: z.strictObject({ to: z.int().optional(), newest: z.int().optional() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "The character as restored",
      content: { "application/json": { schema: characterRecordSchema } },
    },
    404: notFound("character"),
    409: {
      description: "Nothing left to undo, or no entry `to` names",
      content: { "application/json": { schema: errorSchema } },
    },
    412: {
      description: "The character or its undo log changed since the client read them",
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

export function charactersRoutes(
  db: CharactersDb & { $client: Database.Database },
  backup: () => void,
  homebrewDb: { $client: Database.Database },
  dataDir: string,
) {
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

  routes.openapi(exportFile, (c) => {
    const { id } = c.req.valid("param");
    const row = getCharacter(db, id);
    const state = getCharacterState(db, id);
    const pages = listCharacterPages(db, id);
    if (!row || !state || !pages) return c.json({ error: NOT_FOUND }, 404);
    const file: CharacterFile = {
      format: "local-dnd-character-sheet/character",
      version: 2,
      definition: toRecord(row).definition,
      state: toStateRecord(state).state,
      pages: toPageRecords(pages).map(({ preset: _, ...page }) => page),
    };
    return c.json(characterFileSchema.parse(file), 200);
  });

  routes.openapi(
    importFile,
    (c) => {
      const file = c.req.valid("json");
      const id = randomUUID();
      try {
        const row = isLegacy(file)
          ? importWithCustomSkills(
              { charactersDb: db, homebrew: homebrewDb.$client, dataDir },
              id,
              file,
            )
          : importCharacter(db, id, file);
        return c.json(toRecord(row), 201);
      } catch (error) {
        if (error instanceof z.ZodError) return c.json({ error: describeIssues(error) }, 422);
        throw error;
      }
    },
    (result, c) => {
      if (!result.success) return c.json({ error: describeIssues(result.error) }, 422);
    },
  );

  routes.openapi(update, (c) => {
    const { id } = c.req.valid("param");
    const header = c.req.valid("header");
    const since = header["if-unmodified-since"];
    const row = updateCharacterDefinition(
      db,
      id,
      c.req.valid("json"),
      since === undefined ? undefined : new Date(since),
      header["undo-entry"] === "own",
    );
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    if (row === "stale") {
      return c.json({ error: "The character changed since it was read; reload it" }, 412);
    }
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
    const row = getCharacter(db, id);
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    const entries = listUndoEntries(db, id, row.definition).map((entry) => ({
      ...entry,
      changedAt: entry.changedAt.toISOString(),
    }));
    return c.json(undoLogSchema.parse(entries), 200);
  });

  routes.openapi(undo, (c) => {
    const since = c.req.valid("header")["if-unmodified-since"];
    const result = undoChanges(db, c.req.valid("param").id, {
      ...c.req.valid("json"),
      unmodifiedSince: since === undefined ? undefined : new Date(since),
    });
    if (!result) return c.json({ error: NOT_FOUND }, 404);
    if (result.kind === "empty") return c.json({ error: "Nothing to undo" }, 409);
    if (result.kind === "missing") return c.json({ error: "No such undo entry" }, 409);
    if (result.kind === "stale") {
      return c.json({ error: "The character changed since its undo history was read" }, 412);
    }
    if (result.kind === "invalid") return c.json({ error: result.message }, 422);
    return c.json(toRecord(result.row), 200);
  });

  return routes;
}
