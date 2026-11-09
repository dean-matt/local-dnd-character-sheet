/** Record a roll the client made, and read a character's recent rolls. The server never rolls. */
import { rollLogEntrySchema, rollRecordSchema } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { listRolls, recordRoll } from "../db/queries/rolls.ts";
import { notFound } from "./errors.ts";

const idParam = z.object({ id: z.string() });

const NOT_FOUND = "No character with that id";

const list = createRoute({
  method: "get",
  path: "/characters/{id}/rolls",
  tags: ["characters"],
  summary: "List a character's recent rolls, newest first, at most 200",
  request: { params: idParam },
  responses: {
    200: {
      description: "The character's rolls",
      content: { "application/json": { schema: z.array(rollLogEntrySchema) } },
    },
    404: notFound("character"),
  },
});

const record = createRoute({
  method: "post",
  path: "/characters/{id}/rolls",
  tags: ["characters"],
  summary: "Record a roll, pruning the character's oldest past 200",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: rollRecordSchema } } },
  },
  responses: {
    201: {
      description: "The roll as stored",
      content: { "application/json": { schema: rollLogEntrySchema } },
    },
    404: notFound("character"),
  },
});

export function rollsRoutes(db: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(list, (c) => {
    const rolls = listRolls(db, c.req.valid("param").id);
    if (!rolls) return c.json({ error: NOT_FOUND }, 404);
    return c.json(rolls, 200);
  });

  routes.openapi(record, (c) => {
    const stored = recordRoll(db, c.req.valid("param").id, c.req.valid("json"), new Date());
    if (!stored) return c.json({ error: NOT_FOUND }, 404);
    return c.json(stored, 201);
  });

  return routes;
}
