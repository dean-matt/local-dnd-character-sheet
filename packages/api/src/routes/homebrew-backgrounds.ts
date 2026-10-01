/** List, read, create, update and delete for homebrew backgrounds. */
import { randomUUID } from "node:crypto";
import { homebrewBackgroundInputSchema, homebrewBackgroundRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewBackgrounds } from "../db/homebrew.ts";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewBackground,
  getHomebrewBackground,
  type HomebrewDb,
  insertHomebrewBackground,
  listHomebrewBackgrounds,
  updateHomebrewBackground,
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
  toBackgroundRecord,
} from "./homebrew.ts";

const BACKGROUND_NOT_FOUND = "No homebrew background with that id";

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
    409: nameTaken("homebrew background"),
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
    409: nameTaken("homebrew background"),
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

export function homebrewBackgroundsRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listBackgrounds, (c) =>
    c.json(listHomebrewBackgrounds(db).map(toBackgroundRecord)),
  );

  routes.openapi(readBackground, (c) => {
    const row = getHomebrewBackground(db, c.req.valid("param").id);
    if (!row) return c.json({ error: BACKGROUND_NOT_FOUND }, 404);
    return c.json(toBackgroundRecord(row), 200);
  });

  routes.openapi(createBackground, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewBackground(db, randomUUID(), input),
      holder(db, homebrewBackgrounds, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew background", result.taken), 409);
    return c.json(toBackgroundRecord(result.row), 201);
  });

  routes.openapi(updateBackground, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewBackground(db, id, input),
      holder(db, homebrewBackgrounds, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew background", result.taken), 409);
    if (!result.row) return c.json({ error: BACKGROUND_NOT_FOUND }, 404);
    return c.json(toBackgroundRecord(result.row), 200);
  });

  routes.openapi(removeBackground, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This background", characters), 409);
    if (!deleteHomebrewBackground(db, id)) return c.json({ error: BACKGROUND_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
