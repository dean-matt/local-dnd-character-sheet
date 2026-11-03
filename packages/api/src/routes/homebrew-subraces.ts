import { randomUUID } from "node:crypto";
import {
  type HomebrewSubraceInput,
  homebrewSubraceInputSchema,
  homebrewSubraceRecordSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewSubrace,
  findHomebrewSubrace,
  getHomebrewRace,
  getHomebrewSubrace,
  type HomebrewDb,
  insertHomebrewSubrace,
  listHomebrewSubraces,
  updateHomebrewSubrace,
} from "../db/queries/homebrew.ts";
import { getRace } from "../db/queries/races.ts";
import { errorSchema, notFound } from "./errors.ts";
import {
  claimName,
  idParam,
  nameTaken,
  nameTakenError,
  referenced,
  referencedError,
  toSubraceRecord,
} from "./homebrew.ts";

const SUBRACE_NOT_FOUND = "No homebrew subrace with that id";
const RACE_NOT_FOUND = "No race with that name and source, or homebrew race with that id";

const listSubraces = createRoute({
  method: "get",
  path: "/homebrew/subraces",
  tags: ["homebrew"],
  summary: "List every homebrew subrace",
  responses: {
    200: {
      description: "Every homebrew subrace",
      content: { "application/json": { schema: z.array(homebrewSubraceRecordSchema) } },
    },
  },
});

const readSubrace = createRoute({
  method: "get",
  path: "/homebrew/subraces/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew subrace",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew subrace",
      content: { "application/json": { schema: homebrewSubraceRecordSchema } },
    },
    404: notFound("homebrew subrace"),
  },
});

const createSubrace = createRoute({
  method: "post",
  path: "/homebrew/subraces",
  tags: ["homebrew"],
  summary: "Create a homebrew subrace",
  request: {
    body: { content: { "application/json": { schema: homebrewSubraceInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew subrace",
      content: { "application/json": { schema: homebrewSubraceRecordSchema } },
    },
    404: {
      description: "The parent race is neither a catalog race nor a homebrew race",
      content: { "application/json": { schema: errorSchema } },
    },
    409: nameTaken("homebrew subrace"),
  },
});

const updateSubrace = createRoute({
  method: "put",
  path: "/homebrew/subraces/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew subrace",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewSubraceInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew subrace",
      content: { "application/json": { schema: homebrewSubraceRecordSchema } },
    },
    404: {
      description: "No homebrew subrace with that id, or the parent race does not exist",
      content: { "application/json": { schema: errorSchema } },
    },
    409: nameTaken("homebrew subrace"),
  },
});

const removeSubrace = createRoute({
  method: "delete",
  path: "/homebrew/subraces/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew subrace",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew subrace was deleted" },
    404: notFound("homebrew subrace"),
    409: referenced("homebrew subrace"),
  },
});

/** The edition a subrace takes from its parent race, or undefined where no such race exists. */
export function raceEdition(
  db: HomebrewDb,
  dataDir: string,
  parent: HomebrewSubraceInput["parent"],
) {
  return "raceId" in parent
    ? getHomebrewRace(db, parent.raceId)?.edition
    : getRace(dataDir, parent.name, parent.source)?.edition;
}

export function homebrewSubracesRoutes(
  db: HomebrewDb,
  charactersDb: CharactersDb,
  dataDir: string,
) {
  const routes = new OpenAPIHono();

  routes.openapi(listSubraces, (c) => c.json(listHomebrewSubraces(db).map(toSubraceRecord)));

  routes.openapi(readSubrace, (c) => {
    const row = getHomebrewSubrace(db, c.req.valid("param").id);
    if (!row) return c.json({ error: SUBRACE_NOT_FOUND }, 404);
    return c.json(toSubraceRecord(row), 200);
  });

  routes.openapi(createSubrace, (c) => {
    const input = c.req.valid("json");
    const edition = raceEdition(db, dataDir, input.parent);
    if (!edition) return c.json({ error: RACE_NOT_FOUND }, 404);
    const result = claimName(
      () => insertHomebrewSubrace(db, randomUUID(), { ...input, edition }),
      () => findHomebrewSubrace(db, input.parent, input.name),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew subrace", result.taken), 409);
    return c.json(toSubraceRecord(result.row), 201);
  });

  routes.openapi(updateSubrace, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    if (!getHomebrewSubrace(db, id)) return c.json({ error: SUBRACE_NOT_FOUND }, 404);
    const edition = raceEdition(db, dataDir, input.parent);
    if (!edition) return c.json({ error: RACE_NOT_FOUND }, 404);
    const result = claimName(
      () => updateHomebrewSubrace(db, id, { ...input, edition }),
      () => findHomebrewSubrace(db, input.parent, input.name),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew subrace", result.taken), 409);
    if (!result.row) return c.json({ error: SUBRACE_NOT_FOUND }, 404);
    return c.json(toSubraceRecord(result.row), 200);
  });

  routes.openapi(removeSubrace, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This subrace", characters), 409);
    if (!deleteHomebrewSubrace(db, id)) {
      return c.json({ error: SUBRACE_NOT_FOUND }, 404);
    }
    return c.body(null, 204);
  });

  return routes;
}
