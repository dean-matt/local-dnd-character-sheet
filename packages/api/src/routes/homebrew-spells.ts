/** List, read, create, update and delete for homebrew spells. */
import { randomUUID } from "node:crypto";
import { homebrewSpellInputSchema, homebrewSpellRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewSpells } from "../db/homebrew.ts";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewSpell,
  getHomebrewSpell,
  type HomebrewDb,
  insertHomebrewSpell,
  listHomebrewSpells,
  updateHomebrewSpell,
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
  toSpellRecord,
} from "./homebrew.ts";

const SPELL_NOT_FOUND = "No homebrew spell with that id";

const listSpells = createRoute({
  method: "get",
  path: "/homebrew/spells",
  tags: ["homebrew"],
  summary: "List every homebrew spell",
  responses: {
    200: {
      description: "Every homebrew spell",
      content: { "application/json": { schema: z.array(homebrewSpellRecordSchema) } },
    },
  },
});

const readSpell = createRoute({
  method: "get",
  path: "/homebrew/spells/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew spell",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew spell",
      content: { "application/json": { schema: homebrewSpellRecordSchema } },
    },
    404: notFound("homebrew spell"),
  },
});

const createSpell = createRoute({
  method: "post",
  path: "/homebrew/spells",
  tags: ["homebrew"],
  summary: "Create a homebrew spell",
  request: {
    body: { content: { "application/json": { schema: homebrewSpellInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew spell",
      content: { "application/json": { schema: homebrewSpellRecordSchema } },
    },
    409: nameTaken("homebrew spell"),
  },
});

const updateSpell = createRoute({
  method: "put",
  path: "/homebrew/spells/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew spell",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewSpellInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew spell",
      content: { "application/json": { schema: homebrewSpellRecordSchema } },
    },
    404: notFound("homebrew spell"),
    409: nameTaken("homebrew spell"),
  },
});

const removeSpell = createRoute({
  method: "delete",
  path: "/homebrew/spells/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew spell",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew spell was deleted" },
    404: notFound("homebrew spell"),
    409: referenced("homebrew spell"),
  },
});

export function homebrewSpellsRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listSpells, (c) => c.json(listHomebrewSpells(db).map(toSpellRecord)));

  routes.openapi(readSpell, (c) => {
    const row = getHomebrewSpell(db, c.req.valid("param").id);
    if (!row) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.json(toSpellRecord(row), 200);
  });

  routes.openapi(createSpell, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewSpell(db, randomUUID(), input),
      holder(db, homebrewSpells, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew spell", result.taken), 409);
    return c.json(toSpellRecord(result.row), 201);
  });

  routes.openapi(updateSpell, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewSpell(db, id, input),
      holder(db, homebrewSpells, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew spell", result.taken), 409);
    if (!result.row) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.json(toSpellRecord(result.row), 200);
  });

  routes.openapi(removeSpell, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This spell", characters), 409);
    if (!deleteHomebrewSpell(db, id)) return c.json({ error: SPELL_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
