/**
 * List, read, create, update and delete for homebrew items and spells. `source` and `id`
 * are never accepted from a request body — the query layer stamps `source` and this
 * module generates `id` once, on create, the same rule `characters.ts` sets for
 * `name`/`level`/`edition`.
 *
 * A delete needs `characters.db` as well as `homebrew.db`: no foreign key spans the two
 * files, so this route enforces the reference instead.
 */
import { randomUUID } from "node:crypto";
import {
  type HomebrewItemRecord,
  type HomebrewSpellRecord,
  homebrewItemInputSchema,
  homebrewItemRecordSchema,
  homebrewSpellInputSchema,
  homebrewSpellRecordSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import {
  deleteHomebrewItem,
  deleteHomebrewSpell,
  getHomebrewItem,
  getHomebrewSpell,
  insertHomebrewItem,
  insertHomebrewSpell,
  listHomebrewItems,
  listHomebrewSpells,
  updateHomebrewItem,
  updateHomebrewSpell,
} from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";

type ItemRow = NonNullable<ReturnType<typeof getHomebrewItem>>;
type SpellRow = NonNullable<ReturnType<typeof getHomebrewSpell>>;

/** Validates a row read back from SQLite against the same schema its write went through. */
function toItemRecord(row: ItemRow): HomebrewItemRecord {
  return homebrewItemRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

/** Validates a row read back from SQLite against the same schema its write went through. */
function toSpellRecord(row: SpellRow): HomebrewSpellRecord {
  return homebrewSpellRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

const idParam = z.object({ id: z.string() });

const ITEM_NOT_FOUND = "No homebrew item with that id";
const SPELL_NOT_FOUND = "No homebrew spell with that id";

const referencingCharacterSchema = z.object({ id: z.string(), name: z.string() });

const referenced = (resource: string) => ({
  description: `A character still references this ${resource}`,
  content: {
    "application/json": {
      schema: z.object({ error: z.string(), characters: z.array(referencingCharacterSchema) }),
    },
  },
});

const referencedError = (resource: string, characters: { id: string; name: string }[]) => ({
  error: `${resource} is referenced by ${characters.length === 1 ? "a character" : "characters"} and cannot be deleted`,
  characters,
});

const listItems = createRoute({
  method: "get",
  path: "/homebrew/items",
  tags: ["homebrew"],
  summary: "List every homebrew item",
  responses: {
    200: {
      description: "Every homebrew item",
      content: { "application/json": { schema: z.array(homebrewItemRecordSchema) } },
    },
  },
});

const readItem = createRoute({
  method: "get",
  path: "/homebrew/items/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew item",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew item",
      content: { "application/json": { schema: homebrewItemRecordSchema } },
    },
    404: notFound("homebrew item"),
  },
});

const createItem = createRoute({
  method: "post",
  path: "/homebrew/items",
  tags: ["homebrew"],
  summary: "Create a homebrew item",
  request: {
    body: { content: { "application/json": { schema: homebrewItemInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew item",
      content: { "application/json": { schema: homebrewItemRecordSchema } },
    },
  },
});

const updateItem = createRoute({
  method: "put",
  path: "/homebrew/items/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew item",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewItemInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew item",
      content: { "application/json": { schema: homebrewItemRecordSchema } },
    },
    404: notFound("homebrew item"),
  },
});

const removeItem = createRoute({
  method: "delete",
  path: "/homebrew/items/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew item",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew item was deleted" },
    404: notFound("homebrew item"),
    409: referenced("homebrew item"),
  },
});

const listSpells = createRoute({
  method: "get",
  path: "/homebrew/spells",
  tags: ["homebrew"],
  summary: "List every homebrew spell",
  responses: {
    200: {
      description: "Every homebrew spell",
      content: { "application/json": { schema: z.array(homebrewSpellRecordSchema) } },
    },
  },
});

const readSpell = createRoute({
  method: "get",
  path: "/homebrew/spells/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew spell",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew spell",
      content: { "application/json": { schema: homebrewSpellRecordSchema } },
    },
    404: notFound("homebrew spell"),
  },
});

const createSpell = createRoute({
  method: "post",
  path: "/homebrew/spells",
  tags: ["homebrew"],
  summary: "Create a homebrew spell",
  request: {
    body: { content: { "application/json": { schema: homebrewSpellInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew spell",
      content: { "application/json": { schema: homebrewSpellRecordSchema } },
    },
  },
});

const updateSpell = createRoute({
  method: "put",
  path: "/homebrew/spells/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew spell",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewSpellInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew spell",
      content: { "application/json": { schema: homebrewSpellRecordSchema } },
    },
    404: notFound("homebrew spell"),
  },
});

const removeSpell = createRoute({
  method: "delete",
  path: "/homebrew/spells/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew spell",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew spell was deleted" },
    404: notFound("homebrew spell"),
    409: referenced("homebrew spell"),
  },
});

export function homebrewRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listItems, (c) => c.json(listHomebrewItems(db).map(toItemRecord)));

  routes.openapi(readItem, (c) => {
    const row = getHomebrewItem(db, c.req.valid("param").id);
    if (!row) return c.json({ error: ITEM_NOT_FOUND }, 404);
    return c.json(toItemRecord(row), 200);
  });

  routes.openapi(createItem, (c) => {
    const row = insertHomebrewItem(db, randomUUID(), c.req.valid("json"));
    return c.json(toItemRecord(row), 201);
  });

  routes.openapi(updateItem, (c) => {
    const { id } = c.req.valid("param");
    const row = updateHomebrewItem(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: ITEM_NOT_FOUND }, 404);
    return c.json(toItemRecord(row), 200);
  });

  routes.openapi(removeItem, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This item", characters), 409);
    if (!deleteHomebrewItem(db, id)) return c.json({ error: ITEM_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  routes.openapi(listSpells, (c) => c.json(listHomebrewSpells(db).map(toSpellRecord)));

  routes.openapi(readSpell, (c) => {
    const row = getHomebrewSpell(db, c.req.valid("param").id);
    if (!row) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.json(toSpellRecord(row), 200);
  });

  routes.openapi(createSpell, (c) => {
    const row = insertHomebrewSpell(db, randomUUID(), c.req.valid("json"));
    return c.json(toSpellRecord(row), 201);
  });

  routes.openapi(updateSpell, (c) => {
    const { id } = c.req.valid("param");
    const row = updateHomebrewSpell(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.json(toSpellRecord(row), 200);
  });

  routes.openapi(removeSpell, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This spell", characters), 409);
    if (!deleteHomebrewSpell(db, id)) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
