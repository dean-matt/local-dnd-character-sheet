/** A table's ruling on a catalog feature's mechanics, one per feature `(name, source)`. */
import { randomUUID } from "node:crypto";
import {
  type HomebrewFeatureEffectRecord,
  homebrewFeatureEffectInputSchema,
  homebrewFeatureEffectRecordSchema,
} from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { SqliteError } from "better-sqlite3";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import {
  deleteHomebrewFeatureEffect,
  findHomebrewFeatureEffect,
  getHomebrewFeatureEffect,
  insertHomebrewFeatureEffect,
  listHomebrewFeatureEffects,
  updateHomebrewFeatureEffect,
} from "../db/queries/homebrew-feature-effects.ts";
import { notFound } from "./errors.ts";
import { idParam } from "./homebrew.ts";

const NOT_FOUND = "No homebrew feature effect with that id";

const taken = {
  description: "Another effect already rules this feature",
  content: {
    "application/json": {
      schema: z.object({ error: z.string(), existing: homebrewFeatureEffectRecordSchema }),
    },
  },
};

type EffectRow = NonNullable<ReturnType<typeof getHomebrewFeatureEffect>>;

const toRecord = (row: EffectRow) =>
  homebrewFeatureEffectRecordSchema.parse({
    id: row.id,
    name: row.name,
    source: row.source,
    mechanics: row.mechanics,
    createdAt: row.createdAt.toISOString(),
  } satisfies HomebrewFeatureEffectRecord);

const takenError = (row: EffectRow) => ({
  error: `${row.name} (${row.source}) already has an effect`,
  existing: toRecord(row),
});

/** Runs `write`, answering a collision on the feature's unique index with the row that holds it. */
function claim<T>(
  write: () => T,
  holder: () => EffectRow | undefined,
): { row: T } | { taken: EffectRow } {
  try {
    return { row: write() };
  } catch (error) {
    const held =
      error instanceof SqliteError && error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ? holder()
        : undefined;
    if (held === undefined) throw error;
    return { taken: held };
  }
}

const listEffects = createRoute({
  method: "get",
  path: "/homebrew/feature-effects",
  tags: ["homebrew"],
  summary: "List every homebrew feature effect",
  responses: {
    200: {
      description: "Every homebrew feature effect",
      content: { "application/json": { schema: z.array(homebrewFeatureEffectRecordSchema) } },
    },
  },
});

const readEffect = createRoute({
  method: "get",
  path: "/homebrew/feature-effects/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew feature effect",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew feature effect",
      content: { "application/json": { schema: homebrewFeatureEffectRecordSchema } },
    },
    404: notFound("homebrew feature effect"),
  },
});

const createEffect = createRoute({
  method: "post",
  path: "/homebrew/feature-effects",
  tags: ["homebrew"],
  summary: "Create a homebrew feature effect",
  request: {
    body: { content: { "application/json": { schema: homebrewFeatureEffectInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew feature effect",
      content: { "application/json": { schema: homebrewFeatureEffectRecordSchema } },
    },
    409: taken,
  },
});

const updateEffect = createRoute({
  method: "put",
  path: "/homebrew/feature-effects/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew feature effect",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewFeatureEffectInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew feature effect",
      content: { "application/json": { schema: homebrewFeatureEffectRecordSchema } },
    },
    404: notFound("homebrew feature effect"),
    409: taken,
  },
});

const removeEffect = createRoute({
  method: "delete",
  path: "/homebrew/feature-effects/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew feature effect",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew feature effect was deleted" },
    404: notFound("homebrew feature effect"),
  },
});

export function homebrewFeatureEffectsRoutes(db: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listEffects, (c) => c.json(listHomebrewFeatureEffects(db).map(toRecord)));

  routes.openapi(readEffect, (c) => {
    const row = getHomebrewFeatureEffect(db, c.req.valid("param").id);
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toRecord(row), 200);
  });

  routes.openapi(createEffect, (c) => {
    const input = c.req.valid("json");
    const result = claim(
      () => insertHomebrewFeatureEffect(db, randomUUID(), input),
      () => findHomebrewFeatureEffect(db, input),
    );
    if ("taken" in result) return c.json(takenError(result.taken), 409);
    return c.json(toRecord(result.row), 201);
  });

  routes.openapi(updateEffect, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const result = claim(
      () => updateHomebrewFeatureEffect(db, id, input),
      () => findHomebrewFeatureEffect(db, input),
    );
    if ("taken" in result) return c.json(takenError(result.taken), 409);
    if (!result.row) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toRecord(result.row), 200);
  });

  routes.openapi(removeEffect, (c) => {
    if (!deleteHomebrewFeatureEffect(db, c.req.valid("param").id))
      return c.json({ error: NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
