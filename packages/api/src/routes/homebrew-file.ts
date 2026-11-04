/**
 * Writes chosen homebrew rows to one file, and reads such a file back in. A subclass or
 * subrace whose homebrew parent was not chosen brings that parent along, since the file
 * could not recreate it without one.
 *
 * An import keeps each row's id, so a subclass or subrace finds its homebrew parent and a
 * character that cites a row by id resolves it. It writes every row or none.
 */
import {
  type HomebrewExportRequest,
  type HomebrewFile,
  homebrewBackgroundInputSchema,
  homebrewClassFeaturesInputSchema,
  homebrewClassInputSchema,
  homebrewCollectionSchema,
  homebrewDeityInputSchema,
  homebrewExportRequestSchema,
  homebrewFeatInputSchema,
  homebrewFileSchema,
  homebrewImportResultSchema,
  homebrewItemInputSchema,
  homebrewMonsterInputSchema,
  homebrewOptionalFeatureInputSchema,
  homebrewRaceInputSchema,
  homebrewSkillInputSchema,
  homebrewSpellInputSchema,
  homebrewSubclassInputSchema,
  homebrewSubraceInputSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { HomebrewDb } from "../db/queries/homebrew.ts";
import { describeIssues, errorSchema, notFound } from "./errors.ts";
import { type HeldRow, insertUnderId, nounOf, snapshotOf } from "./homebrew-history.ts";

type Collection = z.infer<typeof homebrewCollectionSchema>;
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

const importFile = createRoute({
  method: "post",
  path: "/homebrew/import",
  tags: ["homebrew"],
  summary: "Import a homebrew file",
  description:
    "Creates each row under the id it had, as its kind's save would. A bundled parent already " +
    "here is kept as it is. Any other row already here, a row listed twice, one its kind's " +
    "save would refuse, or a subclass or subrace whose homebrew parent is in neither the file " +
    "nor homebrew refuses the whole file.",
  request: {
    body: { content: { "application/json": { schema: homebrewFileSchema } } },
  },
  responses: {
    201: {
      description: "How many rows the file created",
      content: { "application/json": { schema: homebrewImportResultSchema } },
    },
    409: {
      description: "A row collides with one here or lacks its parent, so nothing was written",
      content: { "application/json": { schema: errorSchema } },
    },
    422: {
      description: "The file fails the schema, so nothing was written",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const ORDER = homebrewCollectionSchema.options;

const INPUTS: Record<Collection, z.ZodType<object>> = {
  items: homebrewItemInputSchema,
  spells: homebrewSpellInputSchema,
  races: homebrewRaceInputSchema,
  subraces: homebrewSubraceInputSchema,
  classes: homebrewClassInputSchema,
  subclasses: homebrewSubclassInputSchema,
  backgrounds: homebrewBackgroundInputSchema,
  feats: homebrewFeatInputSchema,
  skills: homebrewSkillInputSchema,
  deities: homebrewDeityInputSchema,
  "optional-features": homebrewOptionalFeatureInputSchema,
  monsters: homebrewMonsterInputSchema,
};

/** The homebrew row a subclass or subrace hangs from, where it is one. */
function parentOf({ input }: { input: object }): Ref | undefined {
  const { parent } = input as { parent?: { classId?: string; raceId?: string } };
  if (parent?.classId) return { collection: "classes", id: parent.classId };
  if (parent?.raceId) return { collection: "races", id: parent.raceId };
  return undefined;
}

const byKind = (a: { collection: Collection }, b: { collection: Collection }) =>
  ORDER.indexOf(a.collection) - ORDER.indexOf(b.collection);

/** Each entry checked by its kind's own schema, or every field that fails, by its path in the file. */
function heldRows(file: HomebrewFile): HeldRow[] | z.ZodError {
  const issues: z.core.$ZodIssue[] = [];
  const check = <T>(schema: z.ZodType<T>, value: unknown, path: (string | number)[]) => {
    const result = schema.safeParse(value);
    for (const issue of result.error?.issues ?? []) {
      issues.push({ ...issue, path: [...path, ...issue.path] });
    }
    return result.data;
  };
  const rows = file.entries.map(({ collection, id, input, features, resources }, index) => {
    const at = (field: string) => ["entries", index, field];
    return {
      collection,
      id,
      input: check(INPUTS[collection], input, at("input")) ?? input,
      ...(collection === "classes" && {
        features: features && check(homebrewClassFeaturesInputSchema, features, at("features")),
        resources,
      }),
    };
  });
  return issues.length > 0 ? new z.ZodError(issues) : rows;
}

/** Writes `row`, or says why not, naming it. */
function importRow(db: HomebrewDb, dataDir: string, row: HeldRow): string | undefined {
  const named = `The ${nounOf(row.collection)} "${(row.input as { name: string }).name}"`;
  if (snapshotOf(db, row.collection, row.id)) return `${named} is already in homebrew.`;
  const parent = parentOf(row);
  if (parent && !snapshotOf(db, parent.collection, parent.id)) {
    return `${named} hangs from the homebrew ${nounOf(parent.collection)} ${parent.id}, which is in neither the file nor homebrew.`;
  }
  const refusal = insertUnderId(db, dataDir, row);
  return refusal && `${named} cannot be imported. ${refusal.error}`;
}

class ImportRefused extends Error {}

export function homebrewFileRoutes(db: HomebrewDb, dataDir: string) {
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
      entries: [...entries.values()].sort(byKind),
    };
    return c.json(homebrewFileSchema.parse(file), 200);
  });

  routes.openapi(
    importFile,
    (c) => {
      const rows = heldRows(c.req.valid("json"));
      if (rows instanceof z.ZodError) {
        return c.json({ error: describeIssues(rows, "homebrew") }, 422);
      }
      const keys = new Set<string>();
      for (const row of rows) {
        const key = `${row.collection}/${row.id}`;
        if (keys.has(key)) {
          const name = (row.input as { name: string }).name;
          return c.json(
            { error: `The file lists the ${nounOf(row.collection)} "${name}" twice.` },
            409,
          );
        }
        keys.add(key);
      }
      // Export bundles a subclass's or subrace's homebrew parent, so a file for a second
      // subclass of an imported class carries that class again; it is already here.
      const bundled = new Set(
        rows.map(parentOf).map((ref) => ref && `${ref.collection}/${ref.id}`),
      );
      const fresh = rows.filter(
        (row) =>
          !(bundled.has(`${row.collection}/${row.id}`) && snapshotOf(db, row.collection, row.id)),
      );
      try {
        // A parent ahead of what hangs from it, whatever order a hand-edited file holds.
        db.transaction(() => {
          for (const row of fresh.toSorted(byKind)) {
            const refusal = importRow(db, dataDir, row);
            if (refusal) throw new ImportRefused(refusal);
          }
        });
      } catch (error) {
        if (error instanceof ImportRefused) return c.json({ error: error.message }, 409);
        throw error;
      }
      return c.json({ created: fresh.length }, 201);
    },
    (result, c) => {
      if (!result.success) return c.json({ error: describeIssues(result.error, "homebrew") }, 422);
    },
  );

  return routes;
}
