/**
 * List, read, create, update and delete for homebrew items, spells, backgrounds, feats,
 * races and classes. `source` and `id` are never accepted from a request body — the
 * query layer stamps `source` and this module generates `id` once, on create, the same
 * rule `characters.ts` sets for `name`/`level`/`edition`.
 *
 * A delete needs `characters.db` as well as `homebrew.db`: no foreign key spans the two
 * files, so this route enforces the reference instead.
 */
import { randomUUID } from "node:crypto";
import {
  type HomebrewBackgroundRecord,
  type HomebrewClassRecord,
  type HomebrewFeatRecord,
  type HomebrewItemRecord,
  type HomebrewRaceRecord,
  type HomebrewSpellRecord,
  homebrewBackgroundInputSchema,
  homebrewBackgroundRecordSchema,
  homebrewClassInputSchema,
  homebrewClassRecordSchema,
  homebrewFeatInputSchema,
  homebrewFeatRecordSchema,
  homebrewItemInputSchema,
  homebrewItemRecordSchema,
  homebrewRaceInputSchema,
  homebrewRaceRecordSchema,
  homebrewSpellInputSchema,
  homebrewSpellRecordSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import {
  deleteHomebrewBackground,
  deleteHomebrewClass,
  deleteHomebrewFeat,
  deleteHomebrewItem,
  deleteHomebrewRace,
  deleteHomebrewSpell,
  getHomebrewBackground,
  getHomebrewClass,
  getHomebrewFeat,
  getHomebrewItem,
  getHomebrewRace,
  getHomebrewSpell,
  insertHomebrewBackground,
  insertHomebrewClass,
  insertHomebrewFeat,
  insertHomebrewItem,
  insertHomebrewRace,
  insertHomebrewSpell,
  listHomebrewBackgrounds,
  listHomebrewClasses,
  listHomebrewFeats,
  listHomebrewItems,
  listHomebrewRaces,
  listHomebrewSpells,
  updateHomebrewBackground,
  updateHomebrewClass,
  updateHomebrewFeat,
  updateHomebrewItem,
  updateHomebrewRace,
  updateHomebrewSpell,
} from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";

type ItemRow = NonNullable<ReturnType<typeof getHomebrewItem>>;
type SpellRow = NonNullable<ReturnType<typeof getHomebrewSpell>>;
type BackgroundRow = NonNullable<ReturnType<typeof getHomebrewBackground>>;
type FeatRow = NonNullable<ReturnType<typeof getHomebrewFeat>>;
type RaceRow = NonNullable<ReturnType<typeof getHomebrewRace>>;
type ClassRow = NonNullable<ReturnType<typeof getHomebrewClass>>;

/** Validates a row read back from SQLite against the same schema its write went through. */
function toItemRecord(row: ItemRow): HomebrewItemRecord {
  return homebrewItemRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

/** Validates a row read back from SQLite against the same schema its write went through. */
function toSpellRecord(row: SpellRow): HomebrewSpellRecord {
  return homebrewSpellRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

/** Validates a row read back from SQLite against the same schema its write went through. */
function toBackgroundRecord(row: BackgroundRow): HomebrewBackgroundRecord {
  return homebrewBackgroundRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

/** Validates a row read back from SQLite against the same schema its write went through. */
function toFeatRecord(row: FeatRow): HomebrewFeatRecord {
  return homebrewFeatRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

/** Validates a row read back from SQLite against the same schema its write went through. */
function toRaceRecord(row: RaceRow): HomebrewRaceRecord {
  return homebrewRaceRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

/** Validates a row read back from SQLite against the same schema its write went through. */
function toClassRecord(row: ClassRow): HomebrewClassRecord {
  return homebrewClassRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

const idParam = z.object({ id: z.string() });

const ITEM_NOT_FOUND = "No homebrew item with that id";
const SPELL_NOT_FOUND = "No homebrew spell with that id";
const BACKGROUND_NOT_FOUND = "No homebrew background with that id";
const FEAT_NOT_FOUND = "No homebrew feat with that id";
const RACE_NOT_FOUND = "No homebrew race with that id";
const CLASS_NOT_FOUND = "No homebrew class with that id";

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

const listBackgrounds = createRoute({
  method: "get",
  path: "/homebrew/backgrounds",
  tags: ["homebrew"],
  summary: "List every homebrew background",
  responses: {
    200: {
      description: "Every homebrew background",
      content: { "application/json": { schema: z.array(homebrewBackgroundRecordSchema) } },
    },
  },
});

const readBackground = createRoute({
  method: "get",
  path: "/homebrew/backgrounds/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew background",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew background",
      content: { "application/json": { schema: homebrewBackgroundRecordSchema } },
    },
    404: notFound("homebrew background"),
  },
});

const createBackground = createRoute({
  method: "post",
  path: "/homebrew/backgrounds",
  tags: ["homebrew"],
  summary: "Create a homebrew background",
  request: {
    body: { content: { "application/json": { schema: homebrewBackgroundInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew background",
      content: { "application/json": { schema: homebrewBackgroundRecordSchema } },
    },
  },
});

const updateBackground = createRoute({
  method: "put",
  path: "/homebrew/backgrounds/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew background",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewBackgroundInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew background",
      content: { "application/json": { schema: homebrewBackgroundRecordSchema } },
    },
    404: notFound("homebrew background"),
  },
});

const removeBackground = createRoute({
  method: "delete",
  path: "/homebrew/backgrounds/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew background",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew background was deleted" },
    404: notFound("homebrew background"),
    409: referenced("homebrew background"),
  },
});

const listFeats = createRoute({
  method: "get",
  path: "/homebrew/feats",
  tags: ["homebrew"],
  summary: "List every homebrew feat",
  responses: {
    200: {
      description: "Every homebrew feat",
      content: { "application/json": { schema: z.array(homebrewFeatRecordSchema) } },
    },
  },
});

const readFeat = createRoute({
  method: "get",
  path: "/homebrew/feats/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew feat",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew feat",
      content: { "application/json": { schema: homebrewFeatRecordSchema } },
    },
    404: notFound("homebrew feat"),
  },
});

const createFeat = createRoute({
  method: "post",
  path: "/homebrew/feats",
  tags: ["homebrew"],
  summary: "Create a homebrew feat",
  request: {
    body: { content: { "application/json": { schema: homebrewFeatInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew feat",
      content: { "application/json": { schema: homebrewFeatRecordSchema } },
    },
  },
});

const updateFeat = createRoute({
  method: "put",
  path: "/homebrew/feats/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew feat",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewFeatInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew feat",
      content: { "application/json": { schema: homebrewFeatRecordSchema } },
    },
    404: notFound("homebrew feat"),
  },
});

const removeFeat = createRoute({
  method: "delete",
  path: "/homebrew/feats/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew feat",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew feat was deleted" },
    404: notFound("homebrew feat"),
    409: referenced("homebrew feat"),
  },
});

const listRaces = createRoute({
  method: "get",
  path: "/homebrew/races",
  tags: ["homebrew"],
  summary: "List every homebrew race",
  responses: {
    200: {
      description: "Every homebrew race",
      content: { "application/json": { schema: z.array(homebrewRaceRecordSchema) } },
    },
  },
});

const readRace = createRoute({
  method: "get",
  path: "/homebrew/races/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew race",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew race",
      content: { "application/json": { schema: homebrewRaceRecordSchema } },
    },
    404: notFound("homebrew race"),
  },
});

const createRace = createRoute({
  method: "post",
  path: "/homebrew/races",
  tags: ["homebrew"],
  summary: "Create a homebrew race",
  request: {
    body: { content: { "application/json": { schema: homebrewRaceInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew race",
      content: { "application/json": { schema: homebrewRaceRecordSchema } },
    },
  },
});

const updateRace = createRoute({
  method: "put",
  path: "/homebrew/races/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew race",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewRaceInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew race",
      content: { "application/json": { schema: homebrewRaceRecordSchema } },
    },
    404: notFound("homebrew race"),
  },
});

const removeRace = createRoute({
  method: "delete",
  path: "/homebrew/races/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew race",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew race was deleted" },
    404: notFound("homebrew race"),
    409: referenced("homebrew race"),
  },
});

const listClasses = createRoute({
  method: "get",
  path: "/homebrew/classes",
  tags: ["homebrew"],
  summary: "List every homebrew class",
  responses: {
    200: {
      description: "Every homebrew class",
      content: { "application/json": { schema: z.array(homebrewClassRecordSchema) } },
    },
  },
});

const readClass = createRoute({
  method: "get",
  path: "/homebrew/classes/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew class",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew class",
      content: { "application/json": { schema: homebrewClassRecordSchema } },
    },
    404: notFound("homebrew class"),
  },
});

const createClass = createRoute({
  method: "post",
  path: "/homebrew/classes",
  tags: ["homebrew"],
  summary: "Create a homebrew class",
  request: {
    body: { content: { "application/json": { schema: homebrewClassInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew class",
      content: { "application/json": { schema: homebrewClassRecordSchema } },
    },
  },
});

const updateClass = createRoute({
  method: "put",
  path: "/homebrew/classes/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew class",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewClassInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew class",
      content: { "application/json": { schema: homebrewClassRecordSchema } },
    },
    404: notFound("homebrew class"),
  },
});

const removeClass = createRoute({
  method: "delete",
  path: "/homebrew/classes/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew class",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew class was deleted" },
    404: notFound("homebrew class"),
    409: referenced("homebrew class"),
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

  routes.openapi(listBackgrounds, (c) =>
    c.json(listHomebrewBackgrounds(db).map(toBackgroundRecord)),
  );

  routes.openapi(readBackground, (c) => {
    const row = getHomebrewBackground(db, c.req.valid("param").id);
    if (!row) return c.json({ error: BACKGROUND_NOT_FOUND }, 404);
    return c.json(toBackgroundRecord(row), 200);
  });

  routes.openapi(createBackground, (c) => {
    const row = insertHomebrewBackground(db, randomUUID(), c.req.valid("json"));
    return c.json(toBackgroundRecord(row), 201);
  });

  routes.openapi(updateBackground, (c) => {
    const { id } = c.req.valid("param");
    const row = updateHomebrewBackground(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: BACKGROUND_NOT_FOUND }, 404);
    return c.json(toBackgroundRecord(row), 200);
  });

  routes.openapi(removeBackground, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This background", characters), 409);
    if (!deleteHomebrewBackground(db, id)) return c.json({ error: BACKGROUND_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  routes.openapi(listFeats, (c) => c.json(listHomebrewFeats(db).map(toFeatRecord)));

  routes.openapi(readFeat, (c) => {
    const row = getHomebrewFeat(db, c.req.valid("param").id);
    if (!row) return c.json({ error: FEAT_NOT_FOUND }, 404);
    return c.json(toFeatRecord(row), 200);
  });

  routes.openapi(createFeat, (c) => {
    const row = insertHomebrewFeat(db, randomUUID(), c.req.valid("json"));
    return c.json(toFeatRecord(row), 201);
  });

  routes.openapi(updateFeat, (c) => {
    const { id } = c.req.valid("param");
    const row = updateHomebrewFeat(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: FEAT_NOT_FOUND }, 404);
    return c.json(toFeatRecord(row), 200);
  });

  routes.openapi(removeFeat, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This feat", characters), 409);
    if (!deleteHomebrewFeat(db, id)) return c.json({ error: FEAT_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  routes.openapi(listRaces, (c) => c.json(listHomebrewRaces(db).map(toRaceRecord)));

  routes.openapi(readRace, (c) => {
    const row = getHomebrewRace(db, c.req.valid("param").id);
    if (!row) return c.json({ error: RACE_NOT_FOUND }, 404);
    return c.json(toRaceRecord(row), 200);
  });

  routes.openapi(createRace, (c) => {
    const row = insertHomebrewRace(db, randomUUID(), c.req.valid("json"));
    return c.json(toRaceRecord(row), 201);
  });

  routes.openapi(updateRace, (c) => {
    const { id } = c.req.valid("param");
    const row = updateHomebrewRace(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: RACE_NOT_FOUND }, 404);
    return c.json(toRaceRecord(row), 200);
  });

  routes.openapi(removeRace, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This race", characters), 409);
    if (!deleteHomebrewRace(db, id)) return c.json({ error: RACE_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  routes.openapi(listClasses, (c) => c.json(listHomebrewClasses(db).map(toClassRecord)));

  routes.openapi(readClass, (c) => {
    const row = getHomebrewClass(db, c.req.valid("param").id);
    if (!row) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.json(toClassRecord(row), 200);
  });

  routes.openapi(createClass, (c) => {
    const row = insertHomebrewClass(db, randomUUID(), c.req.valid("json"));
    return c.json(toClassRecord(row), 201);
  });

  routes.openapi(updateClass, (c) => {
    const { id } = c.req.valid("param");
    const row = updateHomebrewClass(db, id, c.req.valid("json"));
    if (!row) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.json(toClassRecord(row), 200);
  });

  routes.openapi(removeClass, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This class", characters), 409);
    if (!deleteHomebrewClass(db, id)) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
