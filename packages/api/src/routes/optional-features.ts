/** What entitles a stored character to optional features, one count per grantor and type. */
import { characterDefinitionSchema, optionalFeatureEntitlementsSchema } from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import { getCharacter } from "../db/queries/characters.ts";
import { listOptionalFeatureEntitlements } from "../db/queries/optional-features.ts";
import { catalogOutOfDate, notFound } from "./errors.ts";

const read = createRoute({
  method: "get",
  path: "/characters/{id}/optional-feature-entitlements",
  tags: ["characters"],
  summary: "List what entitles a character to optional features, per grantor and type",
  description:
    "Each class and subclass at the level the character holds it, and each feat and option " +
    "held that grants one. `known` is the grantor's running total, not what its last level added.",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The character's option counts, one per grantor and type",
      content: { "application/json": { schema: optionalFeatureEntitlementsSchema } },
    },
    404: notFound("character"),
    503: catalogOutOfDate,
  },
});

export function optionalFeaturesRoutes(charactersDb: CharactersDb, dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(read, (c) => {
    const row = getCharacter(charactersDb, c.req.valid("param").id);
    if (!row) return c.json({ error: "No character with that id" }, 404);
    const definition = characterDefinitionSchema.parse(row.definition);
    return c.json({ entitlements: listOptionalFeatureEntitlements(dataDir, definition) }, 200);
  });

  return routes;
}
