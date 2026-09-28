/** A stored character's catalog references that no longer resolve, checked on demand. */
import {
  characterDefinitionSchema,
  characterReferencesSchema,
  characterStateSchema,
} from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { getCharacter, getCharacterState } from "../db/queries/characters.ts";
import { checkCharacterReferences } from "../db/queries/references.ts";
import { notFound } from "./errors.ts";

const read = createRoute({
  method: "get",
  path: "/characters/{id}/references",
  tags: ["characters"],
  summary: "List the catalog references a character holds that no catalog row answers",
  description:
    "Each names the definition or state field that holds it. A reference upstream renamed carries " +
    "the row it became as `renamedTo`, and the character is left as stored. Homebrew " +
    "references are ids, and are not checked here.",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The character's unresolved catalog references, in definition order",
      content: { "application/json": { schema: characterReferencesSchema } },
    },
    404: notFound("character"),
  },
});

export function characterReferencesRoutes(charactersDb: CharactersDb, dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(read, (c) => {
    const row = getCharacter(charactersDb, c.req.valid("param").id);
    if (!row) return c.json({ error: "No character with that id" }, 404);
    const definition = characterDefinitionSchema.parse(row.definition);
    const state = characterStateSchema.parse(getCharacterState(charactersDb, row.id)?.state);
    return c.json(
      characterReferencesSchema.parse(checkCharacterReferences(dataDir, definition, state)),
      200,
    );
  });

  return routes;
}
