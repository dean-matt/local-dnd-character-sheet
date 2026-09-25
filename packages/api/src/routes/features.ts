/** A stored character's features, grouped by what granted them and resolved on read. */
import { characterFeaturesSchema } from "@dnd/catalog";
import { characterDefinitionSchema } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { getCharacter } from "../db/queries/characters.ts";
import { resolveCharacterFeatures } from "../db/queries/features.ts";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";

const read = createRoute({
  method: "get",
  path: "/characters/{id}/features",
  tags: ["characters"],
  summary: "List a character's features, traits, feats and optional features",
  description:
    "A reference that resolves to nothing is listed with `resolved: false` and the stored " +
    "name and source, never dropped and never a 4xx.",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The character's features, grouped by what granted them",
      content: { "application/json": { schema: characterFeaturesSchema } },
    },
    404: notFound("character"),
  },
});

export function featuresRoutes(
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
      characterFeaturesSchema.parse(resolveCharacterFeatures(dataDir, homebrewDb, definition)),
      200,
    );
  });

  return routes;
}
