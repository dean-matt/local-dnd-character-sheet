import { randomUUID } from "node:crypto";
import { homebrewMonsterInputSchema, homebrewMonsterRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewMonsters } from "../db/homebrew.ts";
import {
  deleteHomebrewMonster,
  getHomebrewMonster,
  type HomebrewDb,
  insertHomebrewMonster,
  listHomebrewMonsters,
  updateHomebrewMonster,
} from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";
import {
  claimName,
  holder,
  idParam,
  nameTaken,
  nameTakenError,
  toMonsterRecord,
} from "./homebrew.ts";

const MONSTER_NOT_FOUND = "No homebrew monster with that id";

const listMonsters = createRoute({
  method: "get",
  path: "/homebrew/monsters",
  tags: ["homebrew"],
  summary: "List every homebrew monster",
  responses: {
    200: {
      description: "Every homebrew monster",
      content: { "application/json": { schema: z.array(homebrewMonsterRecordSchema) } },
    },
  },
});

const readMonster = createRoute({
  method: "get",
  path: "/homebrew/monsters/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew monster",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew monster",
      content: { "application/json": { schema: homebrewMonsterRecordSchema } },
    },
    404: notFound("homebrew monster"),
  },
});

const createMonster = createRoute({
  method: "post",
  path: "/homebrew/monsters",
  tags: ["homebrew"],
  summary: "Create a homebrew monster",
  request: {
    body: { content: { "application/json": { schema: homebrewMonsterInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew monster",
      content: { "application/json": { schema: homebrewMonsterRecordSchema } },
    },
    409: nameTaken("homebrew monster"),
  },
});

const updateMonster = createRoute({
  method: "put",
  path: "/homebrew/monsters/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew monster",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewMonsterInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew monster",
      content: { "application/json": { schema: homebrewMonsterRecordSchema } },
    },
    404: notFound("homebrew monster"),
    409: nameTaken("homebrew monster"),
  },
});

const removeMonster = createRoute({
  method: "delete",
  path: "/homebrew/monsters/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew monster",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew monster was deleted" },
    404: notFound("homebrew monster"),
  },
});

export function homebrewMonstersRoutes(db: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listMonsters, (c) => c.json(listHomebrewMonsters(db).map(toMonsterRecord)));

  routes.openapi(readMonster, (c) => {
    const row = getHomebrewMonster(db, c.req.valid("param").id);
    if (!row) return c.json({ error: MONSTER_NOT_FOUND }, 404);
    return c.json(toMonsterRecord(row), 200);
  });

  routes.openapi(createMonster, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewMonster(db, randomUUID(), input),
      holder(db, homebrewMonsters, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew monster", result.taken), 409);
    return c.json(toMonsterRecord(result.row), 201);
  });

  routes.openapi(updateMonster, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewMonster(db, id, input),
      holder(db, homebrewMonsters, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew monster", result.taken), 409);
    if (!result.row) return c.json({ error: MONSTER_NOT_FOUND }, 404);
    return c.json(toMonsterRecord(result.row), 200);
  });

  routes.openapi(removeMonster, (c) => {
    const { id } = c.req.valid("param");
    if (!deleteHomebrewMonster(db, id)) return c.json({ error: MONSTER_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
