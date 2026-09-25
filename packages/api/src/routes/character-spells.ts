/** A stored character's spells, resolved on read against the catalog and homebrew. */
import { characterSpellsSchema } from "@dnd/catalog";
import { characterDefinitionSchema } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { resolveCharacterSpells } from "../db/queries/character-spells.ts";
import type { CharactersDb } from "../db/queries/characters.ts";
import { getCharacter } from "../db/queries/characters.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";

const read = createRoute({
  method: "get",
  path: "/characters/{id}/spells",
  tags: ["characters"],
  summary: "List a character's spells, each resolved against its catalog or homebrew row",
  description:
    "In the order the definition lists them. A reference that resolves to nothing is " +
    "listed with `resolved: false` and the stored name and source, never dropped and never a 4xx.",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The character's spells",
      content: { "application/json": { schema: characterSpellsSchema } },
    },
    404: notFound("character"),
  },
});

export function characterSpellsRoutes(
  charactersDb: CharactersDb,
  dataDir: string,
  homebrewDb: HomebrewDb,
) {
  const routes = new OpenAPIHono();

  routes.openapi(read, (c) => {
    const row = getCharacter(charactersDb, c.req.valid("param").id);
    if (!row) return c.json({ error: "No character with that id" }, 404);
    const definition = characterDefinitionSchema.parse(row.definition);
    return c.json(
      characterSpellsSchema.parse(resolveCharacterSpells(dataDir, homebrewDb, definition)),
      200,
    );
  });

  return routes;
}
