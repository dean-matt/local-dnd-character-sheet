/** Record a roll the client made, and read every character's recent rolls. The server never rolls. */
import { rollLogEntrySchema, rollRecordSchema } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { listRolls, recordRoll } from "../db/queries/rolls.ts";
import { notFound } from "./errors.ts";

const idParam = z.object({ id: z.string() });

const NOT_FOUND = "No character with that id";

const list = createRoute({
  method: "get",
  path: "/rolls",
  tags: ["characters"],
  summary: "List every character's recent rolls, newest first, each character's last 200",
  responses: {
    200: {
      description: "The rolls, each with the character that made it",
      content: { "application/json": { schema: z.array(rollLogEntrySchema) } },
    },
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

  routes.openapi(list, (c) => c.json(listRolls(db), 200));

  routes.openapi(record, (c) => {
    const stored = recordRoll(db, c.req.valid("param").id, c.req.valid("json"), new Date());
    if (!stored) return c.json({ error: NOT_FOUND }, 404);
    return c.json(stored, 201);
  });

  return routes;
}
