/** List, read, create, update and delete for homebrew races. */
import { randomUUID } from "node:crypto";
import { homebrewRaceInputSchema, homebrewRaceRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewRaces } from "../db/homebrew.ts";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewRace,
  getHomebrewRace,
  type HomebrewDb,
  insertHomebrewRace,
  listHomebrewRaces,
  updateHomebrewRace,
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
  toRaceRecord,
} from "./homebrew.ts";

const RACE_NOT_FOUND = "No homebrew race with that id";

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
    409: nameTaken("homebrew race"),
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
    409: nameTaken("homebrew race"),
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

export function homebrewRacesRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listRaces, (c) => c.json(listHomebrewRaces(db).map(toRaceRecord)));

  routes.openapi(readRace, (c) => {
    const row = getHomebrewRace(db, c.req.valid("param").id);
    if (!row) return c.json({ error: RACE_NOT_FOUND }, 404);
    return c.json(toRaceRecord(row), 200);
  });

  routes.openapi(createRace, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewRace(db, randomUUID(), input),
      holder(db, homebrewRaces, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew race", result.taken), 409);
    return c.json(toRaceRecord(result.row), 201);
  });

  routes.openapi(updateRace, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewRace(db, id, input),
      holder(db, homebrewRaces, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew race", result.taken), 409);
    if (!result.row) return c.json({ error: RACE_NOT_FOUND }, 404);
    return c.json(toRaceRecord(result.row), 200);
  });

  routes.openapi(removeRace, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This race", characters), 409);
    if (!deleteHomebrewRace(db, id)) return c.json({ error: RACE_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
