/** A stored character's inventory, resolved on read against the catalog and homebrew. */
import { characterInventorySchema } from "@dnd/catalog";
import { characterDefinitionSchema } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { getCharacter } from "../db/queries/characters.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { resolveCharacterInventory } from "../db/queries/inventory.ts";
import { notFound } from "./errors.ts";

const read = createRoute({
  method: "get",
  path: "/characters/{id}/inventory",
  tags: ["characters"],
  summary: "List a character's items, each resolved against its catalog or homebrew row",
  description:
    "In the order the definition lists them, a magic variant expanded against its base " +
    "item. A reference that resolves to nothing, or a variant its base item refuses, is " +
    "listed with `resolved: false`, never dropped and never a 4xx.",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The character's items",
      content: { "application/json": { schema: characterInventorySchema } },
    },
    404: notFound("character"),
  },
});

export function characterInventoryRoutes(
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
      characterInventorySchema.parse(resolveCharacterInventory(dataDir, homebrewDb, definition)),
      200,
    );
  });

  return routes;
}
