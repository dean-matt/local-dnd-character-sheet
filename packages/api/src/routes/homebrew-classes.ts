/** List, read, create, update and delete for homebrew classes. */
import { randomUUID } from "node:crypto";
import { homebrewClassInputSchema, homebrewClassRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewClasses } from "../db/homebrew.ts";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewClass,
  getHomebrewClass,
  type HomebrewDb,
  insertHomebrewClass,
  listHomebrewClasses,
  updateHomebrewClass,
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
  toClassRecord,
} from "./homebrew.ts";

const CLASS_NOT_FOUND = "No homebrew class with that id";

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
    409: nameTaken("homebrew class"),
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
    409: nameTaken("homebrew class"),
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

export function homebrewClassesRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listClasses, (c) => c.json(listHomebrewClasses(db).map(toClassRecord)));

  routes.openapi(readClass, (c) => {
    const row = getHomebrewClass(db, c.req.valid("param").id);
    if (!row) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.json(toClassRecord(row), 200);
  });

  routes.openapi(createClass, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewClass(db, randomUUID(), input),
      holder(db, homebrewClasses, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew class", result.taken), 409);
    return c.json(toClassRecord(result.row), 201);
  });

  routes.openapi(updateClass, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewClass(db, id, input),
      holder(db, homebrewClasses, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew class", result.taken), 409);
    if (!result.row) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.json(toClassRecord(result.row), 200);
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
