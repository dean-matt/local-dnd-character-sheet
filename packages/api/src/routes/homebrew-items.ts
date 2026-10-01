/** List, read, create, update and delete for homebrew items. */
import { randomUUID } from "node:crypto";
import { homebrewItemInputSchema, homebrewItemRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewItems } from "../db/homebrew.ts";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewItem,
  getHomebrewItem,
  type HomebrewDb,
  insertHomebrewItem,
  listHomebrewItems,
  updateHomebrewItem,
} from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";
import {
  claimName,
  holder,
  idParam,
  nameTaken,
  nameTakenError,
  referenced,
  referencedError,
  toItemRecord,
} from "./homebrew.ts";

const ITEM_NOT_FOUND = "No homebrew item with that id";

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
    409: nameTaken("homebrew item"),
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
    409: nameTaken("homebrew item"),
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

export function homebrewItemsRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listItems, (c) => c.json(listHomebrewItems(db).map(toItemRecord)));

  routes.openapi(readItem, (c) => {
    const row = getHomebrewItem(db, c.req.valid("param").id);
    if (!row) return c.json({ error: ITEM_NOT_FOUND }, 404);
    return c.json(toItemRecord(row), 200);
  });

  routes.openapi(createItem, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewItem(db, randomUUID(), input),
      holder(db, homebrewItems, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew item", result.taken), 409);
    return c.json(toItemRecord(result.row), 201);
  });

  routes.openapi(updateItem, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewItem(db, id, input),
      holder(db, homebrewItems, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew item", result.taken), 409);
    if (!result.row) return c.json({ error: ITEM_NOT_FOUND }, 404);
    return c.json(toItemRecord(result.row), 200);
  });

  routes.openapi(removeItem, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This item", characters), 409);
    if (!deleteHomebrewItem(db, id)) return c.json({ error: ITEM_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
