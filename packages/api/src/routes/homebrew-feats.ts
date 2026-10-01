/** List, read, create, update and delete for homebrew feats. */
import { randomUUID } from "node:crypto";
import { homebrewFeatInputSchema, homebrewFeatRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewFeats } from "../db/homebrew.ts";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewFeat,
  getHomebrewFeat,
  type HomebrewDb,
  insertHomebrewFeat,
  listHomebrewFeats,
  updateHomebrewFeat,
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
  toFeatRecord,
} from "./homebrew.ts";

const FEAT_NOT_FOUND = "No homebrew feat with that id";

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
    409: nameTaken("homebrew feat"),
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
    409: nameTaken("homebrew feat"),
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

export function homebrewFeatsRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listFeats, (c) => c.json(listHomebrewFeats(db).map(toFeatRecord)));

  routes.openapi(readFeat, (c) => {
    const row = getHomebrewFeat(db, c.req.valid("param").id);
    if (!row) return c.json({ error: FEAT_NOT_FOUND }, 404);
    return c.json(toFeatRecord(row), 200);
  });

  routes.openapi(createFeat, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewFeat(db, randomUUID(), input),
      holder(db, homebrewFeats, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew feat", result.taken), 409);
    return c.json(toFeatRecord(result.row), 201);
  });

  routes.openapi(updateFeat, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewFeat(db, id, input),
      holder(db, homebrewFeats, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew feat", result.taken), 409);
    if (!result.row) return c.json({ error: FEAT_NOT_FOUND }, 404);
    return c.json(toFeatRecord(result.row), 200);
  });

  routes.openapi(removeFeat, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This feat", characters), 409);
    if (!deleteHomebrewFeat(db, id)) return c.json({ error: FEAT_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
