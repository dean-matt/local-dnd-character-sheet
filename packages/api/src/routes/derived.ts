/** A stored character's derived block, computed on read and never stored. */
import { characterDefinitionSchema, characterDerivedSchema, deriveCharacter } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { getCharacter } from "../db/queries/characters.ts";
import { resolveCharacterCatalog, UnresolvedReference } from "../db/queries/derived.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { errorSchema, notFound } from "./errors.ts";

const read = createRoute({
  method: "get",
  path: "/characters/{id}/derived",
  tags: ["characters"],
  summary: "Compute a character's derived block",
  description:
    "An equipped item or a casting ability that resolves to nothing is left out of the " +
    "block; a class or race that resolves to nothing has no value to fall back on and is a 422.",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The character's derived block",
      content: { "application/json": { schema: characterDerivedSchema } },
    },
    404: notFound("character"),
    422: {
      description: "The character names a class or race no catalog or homebrew row answers",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export function derivedRoutes(charactersDb: CharactersDb, dataDir: string, homebrewDb: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(read, (c) => {
    const row = getCharacter(charactersDb, c.req.valid("param").id);
    if (!row) return c.json({ error: "No character with that id" }, 404);
    const definition = characterDefinitionSchema.parse(row.definition);
    try {
      const catalog = resolveCharacterCatalog(dataDir, homebrewDb, definition);
      return c.json(characterDerivedSchema.parse(deriveCharacter(definition, catalog)), 200);
    } catch (error) {
      if (error instanceof UnresolvedReference) return c.json({ error: error.message }, 422);
      throw error;
    }
  });

  return routes;
}
