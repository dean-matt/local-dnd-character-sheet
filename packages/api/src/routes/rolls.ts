/** Record a roll the client made, read every character's recent rolls, and clear them. The server never rolls. */
import { rollLogEntrySchema, rollRecordSchema } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { clearRolls, listRolls, recordRoll } from "../db/queries/rolls.ts";
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

const clear = createRoute({
  method: "delete",
  path: "/rolls",
  tags: ["characters"],
  summary: "Clear every character's rolls",
  responses: {
    204: { description: "The rolls were cleared" },
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

  routes.openapi(clear, (c) => {
    clearRolls(db);
    return c.body(null, 204);
  });

  routes.openapi(record, (c) => {
    const stored = recordRoll(db, c.req.valid("param").id, c.req.valid("json"), new Date());
    if (!stored) return c.json({ error: NOT_FOUND }, 404);
    return c.json(stored, 201);
  });

  return routes;
}
