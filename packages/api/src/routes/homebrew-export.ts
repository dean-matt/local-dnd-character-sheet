/**
 * Writes chosen homebrew rows to one file. A subclass or subrace whose homebrew parent was
 * not chosen brings that parent along, since the file could not recreate it without one.
 */
import {
  type HomebrewExportRequest,
  type HomebrewFile,
  homebrewCollectionSchema,
  homebrewExportRequestSchema,
  homebrewFileSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { notFound } from "./errors.ts";
import { snapshotOf } from "./homebrew-history.ts";

type Ref = HomebrewExportRequest["entries"][number];
type Entry = HomebrewFile["entries"][number];

const exportFile = createRoute({
  method: "post",
  path: "/homebrew/export",
  tags: ["homebrew"],
  summary: "Export homebrew rows as one file",
  description:
    "Each row as its kind's save would write it, a class with its features and resource " +
    "tables. A subclass or subrace whose homebrew parent is not listed adds that parent.",
  request: {
    body: { content: { "application/json": { schema: homebrewExportRequestSchema } } },
  },
  responses: {
    200: {
      description: "The homebrew file",
      content: { "application/json": { schema: homebrewFileSchema } },
    },
    404: notFound("homebrew row", "id"),
  },
});

const ORDER = homebrewCollectionSchema.options;

/** The homebrew row a subclass or subrace hangs from, where it is one. */
function parentOf({ input }: Entry): Ref | undefined {
  const { parent } = input as { parent?: { classId?: string; raceId?: string } };
  if (parent?.classId) return { collection: "classes", id: parent.classId };
  if (parent?.raceId) return { collection: "races", id: parent.raceId };
  return undefined;
}

export function homebrewExportRoutes(db: HomebrewDb) {
  const routes = new OpenAPIHono();

  routes.openapi(exportFile, (c) => {
    const entries = new Map<string, Entry>();
    const pending = [...c.req.valid("json").entries];
    for (let ref = pending.shift(); ref; ref = pending.shift()) {
      const key = `${ref.collection}/${ref.id}`;
      if (entries.has(key)) continue;
      const snapshot = snapshotOf(db, ref.collection, ref.id);
      if (!snapshot) return c.json({ error: `No homebrew row ${key}` }, 404);
      const { name: _name, ...held } = snapshot;
      const entry = { ...ref, ...held };
      entries.set(key, entry);
      const parent = parentOf(entry);
      if (parent) pending.push(parent);
    }
    const file: HomebrewFile = {
      format: "local-dnd-character-sheet/homebrew",
      version: 1,
      entries: [...entries.values()].sort(
        (a, b) => ORDER.indexOf(a.collection) - ORDER.indexOf(b.collection),
      ),
    };
    return c.json(homebrewFileSchema.parse(file), 200);
  });

  return routes;
}
