/** Homebrew optional features: the pool side, a feature type list. A name is unique within each of its types and its edition. */
import { randomUUID } from "node:crypto";
import {
  homebrewOptionalFeatureInputSchema,
  homebrewOptionalFeatureRecordSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import {
  deleteHomebrewOptionalFeature,
  findHomebrewOptionalFeature,
  getHomebrewOptionalFeature,
  type HomebrewDb,
  insertHomebrewOptionalFeature,
  listHomebrewOptionalFeatures,
  updateHomebrewOptionalFeature,
} from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";
import {
  claimName,
  idParam,
  nameTaken,
  nameTakenError,
  referenced,
  referencedError,
  toOptionalFeatureRecord,
} from "./homebrew.ts";

const OPTIONAL_FEATURE_NOT_FOUND = "No homebrew optional feature with that id";

const listOptionalFeatures = createRoute({
  method: "get",
  path: "/homebrew/optional-features",
  tags: ["homebrew"],
  summary: "List every homebrew optional feature",
  responses: {
    200: {
      description: "Every homebrew optional feature",
      content: { "application/json": { schema: z.array(homebrewOptionalFeatureRecordSchema) } },
    },
  },
});

const readOptionalFeature = createRoute({
  method: "get",
  path: "/homebrew/optional-features/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew optional feature",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew optional feature",
      content: { "application/json": { schema: homebrewOptionalFeatureRecordSchema } },
    },
    404: notFound("homebrew optional feature"),
  },
});

const createOptionalFeature = createRoute({
  method: "post",
  path: "/homebrew/optional-features",
  tags: ["homebrew"],
  summary: "Create a homebrew optional feature",
  request: {
    body: { content: { "application/json": { schema: homebrewOptionalFeatureInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew optional feature",
      content: { "application/json": { schema: homebrewOptionalFeatureRecordSchema } },
    },
    409: nameTaken("homebrew optional feature"),
  },
});

const updateOptionalFeature = createRoute({
  method: "put",
  path: "/homebrew/optional-features/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew optional feature",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewOptionalFeatureInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew optional feature",
      content: { "application/json": { schema: homebrewOptionalFeatureRecordSchema } },
    },
    404: notFound("homebrew optional feature"),
    409: nameTaken("homebrew optional feature"),
  },
});

const removeOptionalFeature = createRoute({
  method: "delete",
  path: "/homebrew/optional-features/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew optional feature",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew optional feature was deleted" },
    404: notFound("homebrew optional feature"),
    409: referenced("homebrew optional feature"),
  },
});

export function homebrewOptionalFeaturesRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listOptionalFeatures, (c) =>
    c.json(listHomebrewOptionalFeatures(db).map(toOptionalFeatureRecord)),
  );

  routes.openapi(readOptionalFeature, (c) => {
    const row = getHomebrewOptionalFeature(db, c.req.valid("param").id);
    if (!row) return c.json({ error: OPTIONAL_FEATURE_NOT_FOUND }, 404);
    return c.json(toOptionalFeatureRecord(row), 200);
  });

  routes.openapi(createOptionalFeature, (c) => {
    const input = c.req.valid("json");
    const result = claimName(
      () => insertHomebrewOptionalFeature(db, randomUUID(), input),
      () => findHomebrewOptionalFeature(db, input),
    );
    if ("taken" in result)
      return c.json(nameTakenError("homebrew optional feature", result.taken), 409);
    return c.json(toOptionalFeatureRecord(result.row), 201);
  });

  routes.openapi(updateOptionalFeature, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claimName(
      () => updateHomebrewOptionalFeature(db, id, input),
      () => findHomebrewOptionalFeature(db, input, id),
    );
    if ("taken" in result)
      return c.json(nameTakenError("homebrew optional feature", result.taken), 409);
    if (!result.row) return c.json({ error: OPTIONAL_FEATURE_NOT_FOUND }, 404);
    return c.json(toOptionalFeatureRecord(result.row), 200);
  });

  routes.openapi(removeOptionalFeature, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0)
      return c.json(referencedError("This optional feature", characters), 409);
    if (!deleteHomebrewOptionalFeature(db, id))
      return c.json({ error: OPTIONAL_FEATURE_NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
