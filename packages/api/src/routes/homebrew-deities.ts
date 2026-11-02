/**
 * Homebrew deities, keyed by name and pantheon, unique together ignoring case. A character
 * cites one by `(name, "HB", pantheon)`, so a rename or a move to another pantheon is refused
 * while one holds it, as is a delete.
 */
import { randomUUID } from "node:crypto";
import {
  type HomebrewDeityInput,
  homebrewDeityInputSchema,
  homebrewDeityRecordSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { SqliteError } from "better-sqlite3";
import { type CharactersDb, charactersReferencingHomebrewDeity } from "../db/queries/characters.ts";
import {
  deleteHomebrewDeity,
  findHomebrewDeity,
  getHomebrewDeity,
  type HomebrewDb,
  insertHomebrewDeity,
  listHomebrewDeities,
  updateHomebrewDeity,
} from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";
import { idParam, referenced, referencedError, toDeityRecord } from "./homebrew.ts";

const DEITY_NOT_FOUND = "No homebrew deity with that id";

const conflictSchema = z.object({
  error: z.string(),
  conflict: z.object({ id: z.string(), name: z.string(), pantheon: z.string() }),
});

export const deityNameTaken = {
  description: "Another homebrew deity of that pantheon already has this name",
  content: { "application/json": { schema: conflictSchema } },
};

export const deityNameTakenError = ({
  id,
  name,
  pantheon,
}: {
  id: string;
  name: string;
  pantheon: string;
}) => ({
  error: `The homebrew deity ${id} is already named "${name}" in the ${pantheon} pantheon`,
  conflict: { id, name, pantheon },
});

/**
 * Runs `write`, answering a collision on the unique index with the deity holding the key.
 * The index decides, so a write that collides with nothing never pays the lookup.
 */
export function claimDeity<T>(
  write: () => T,
  holder: () => { id: string; name: string; pantheon: string } | undefined,
): { row: T } | { taken: { id: string; name: string; pantheon: string } } {
  try {
    return { row: write() };
  } catch (error) {
    const taken =
      error instanceof SqliteError && error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ? holder()
        : undefined;
    if (taken === undefined) throw error;
    return { taken };
  }
}

const listDeities = createRoute({
  method: "get",
  path: "/homebrew/deities",
  tags: ["homebrew"],
  summary: "List every homebrew deity",
  responses: {
    200: {
      description: "Every homebrew deity",
      content: { "application/json": { schema: z.array(homebrewDeityRecordSchema) } },
    },
  },
});

const readDeity = createRoute({
  method: "get",
  path: "/homebrew/deities/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew deity",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew deity",
      content: { "application/json": { schema: homebrewDeityRecordSchema } },
    },
    404: notFound("homebrew deity"),
  },
});

const createDeity = createRoute({
  method: "post",
  path: "/homebrew/deities",
  tags: ["homebrew"],
  summary: "Create a homebrew deity",
  request: {
    body: { content: { "application/json": { schema: homebrewDeityInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew deity",
      content: { "application/json": { schema: homebrewDeityRecordSchema } },
    },
    409: deityNameTaken,
  },
});

const updateDeity = createRoute({
  method: "put",
  path: "/homebrew/deities/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew deity",
  description:
    "A character cites a deity by name and pantheon, so changing either is refused while one holds it.",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewDeityInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew deity",
      content: { "application/json": { schema: homebrewDeityRecordSchema } },
    },
    404: notFound("homebrew deity"),
    409: {
      description:
        "Another deity of that pantheon has this name, or a character holds the deity and the name or pantheon would change",
      content: {
        "application/json": {
          schema: z.union([conflictSchema, referenced("deity").content["application/json"].schema]),
        },
      },
    },
  },
});

const removeDeity = createRoute({
  method: "delete",
  path: "/homebrew/deities/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew deity",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew deity was deleted" },
    404: notFound("homebrew deity"),
    409: referenced("deity"),
  },
});

export function homebrewDeitiesRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  const holder = (input: HomebrewDeityInput) => () => findHomebrewDeity(db, input);

  routes.openapi(listDeities, (c) => c.json(listHomebrewDeities(db).map(toDeityRecord)));

  routes.openapi(readDeity, (c) => {
    const row = getHomebrewDeity(db, c.req.valid("param").id);
    if (!row) return c.json({ error: DEITY_NOT_FOUND }, 404);
    return c.json(toDeityRecord(row), 200);
  });

  routes.openapi(createDeity, (c) => {
    const input = c.req.valid("json");
    const result = claimDeity(() => insertHomebrewDeity(db, randomUUID(), input), holder(input));
    if ("taken" in result) return c.json(deityNameTakenError(result.taken), 409);
    return c.json(toDeityRecord(result.row), 201);
  });

  routes.openapi(updateDeity, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const current = getHomebrewDeity(db, id);
    const key = (d: { name: string; pantheon: string }) => `${d.name}\0${d.pantheon}`.toLowerCase();
    if (current && key(current) !== key(input)) {
      const characters = charactersReferencingHomebrewDeity(charactersDb, current);
      if (characters.length > 0) {
        return c.json(
          {
            ...referencedError("deity", characters),
            error: `This deity is held by ${characters.map(({ name }) => name).join(", ")} and its name or pantheon cannot be changed`,
          },
          409,
        );
      }
    }
    const result = claimDeity(() => updateHomebrewDeity(db, id, input), holder(input));
    if ("taken" in result) return c.json(deityNameTakenError(result.taken), 409);
    if (!result.row) return c.json({ error: DEITY_NOT_FOUND }, 404);
    return c.json(toDeityRecord(result.row), 200);
  });

  routes.openapi(removeDeity, (c) => {
    const { id } = c.req.valid("param");
    const current = getHomebrewDeity(db, id);
    if (!current) return c.json({ error: DEITY_NOT_FOUND }, 404);
    const characters = charactersReferencingHomebrewDeity(charactersDb, current);
    if (characters.length > 0) return c.json(referencedError("deity", characters), 409);
    deleteHomebrewDeity(db, id);
    return c.body(null, 204);
  });

  return routes;
}
