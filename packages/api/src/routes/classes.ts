/**
 * Reads `content.db`'s class and subclass tables. No homebrew class exists to merge in.
 * `docs/class-tables.md` describes what a resource key means and the traps in the
 * upstream shape it came from; this file does not restate them.
 */
import {
  type ClassFeatureRecord,
  type ClassGrants,
  type ClassRecord,
  classFeatureRecordSchema,
  classGrantsSchema,
  classRecordSchema,
  preparedSpellCountSchema,
  type SubclassRecord,
  subclassRecordSchema,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  type ClassFeatureRow,
  type ClassGrantsRow,
  type ClassRow,
  getClass,
  getClassGrants,
  getPreparedSpellCount,
  getSubclass,
  getSubclassGrants,
  listClasses,
  listSubclasses,
  type SubclassRow,
} from "../db/queries/content.ts";
import { notFound } from "./errors.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toClassRecord(row: ClassRow): ClassRecord {
  return classRecordSchema.parse({
    name: row.name,
    source: row.source,
    edition: row.edition,
    hitDie: row.hit_die,
    json: JSON.parse(row.json),
  });
}

function toSubclassRecord(row: SubclassRow): SubclassRecord {
  return subclassRecordSchema.parse({
    name: row.name,
    source: row.source,
    shortName: row.short_name,
    className: row.class_name,
    classSource: row.class_source,
    edition: row.edition,
    json: JSON.parse(row.json),
  });
}

function toFeatureRecord(row: ClassFeatureRow): ClassFeatureRecord {
  return classFeatureRecordSchema.parse({
    name: row.name,
    source: row.source,
    level: row.level,
    json: JSON.parse(row.json),
  });
}

function toGrants(level: number, row: ClassGrantsRow): ClassGrants {
  return classGrantsSchema.parse({
    level,
    resources: row.resources.map((r) => ({ resourceKey: r.resource_key, value: r.value })),
    spellSlots: row.spellSlots.map((s) => ({ slotLevel: s.slot_level, slots: s.slots })),
    optionalFeatures: row.optionalFeatures.map((o) => ({
      featureType: o.feature_type,
      known: o.known,
    })),
    features: row.features.map(toFeatureRecord),
  });
}

const listQuery = z.object({
  edition: z.enum(EDITIONS),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const classListResponseSchema = z.object({
  items: z.array(classRecordSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const listClassesRoute = createRoute({
  method: "get",
  path: "/classes",
  tags: ["classes"],
  summary: "List classes of one edition",
  request: { query: listQuery },
  responses: {
    200: {
      description: "A page of classes, bounded by limit and offset",
      content: { "application/json": { schema: classListResponseSchema } },
    },
  },
});

const nameSourceParam = z.object({ name: z.string(), source: z.string() });

const readClassRoute = createRoute({
  method: "get",
  path: "/classes/{name}/{source}",
  tags: ["classes"],
  summary: "Read one class by name and source",
  request: { params: nameSourceParam },
  responses: {
    200: {
      description: "The class",
      content: { "application/json": { schema: classRecordSchema } },
    },
    404: notFound("class", "name and source"),
  },
});

const levelParam = z.object({
  name: z.string(),
  source: z.string(),
  level: z.coerce.number().int().min(1).max(20),
});

const readClassGrantsRoute = createRoute({
  method: "get",
  path: "/classes/{name}/{source}/at/{level}",
  tags: ["classes"],
  summary: "Read what a class grants by one level",
  request: { params: levelParam },
  responses: {
    200: {
      description:
        "The resources, slots, optional features and features the class grants by that level. A level a class grants nothing at is empty arrays, not a 404.",
      content: { "application/json": { schema: classGrantsSchema } },
    },
    404: notFound("class", "name and source"),
  },
});

const readPreparedSpellCountRoute = createRoute({
  method: "get",
  path: "/classes/{name}/{source}/at/{level}/prepared-spells",
  tags: ["classes"],
  summary: "Read a `one` class's Prepared Spells column at one level",
  request: { params: levelParam },
  responses: {
    200: {
      description: "The printed count, or prepares: false where the class carries no such column",
      content: { "application/json": { schema: preparedSpellCountSchema } },
    },
    404: notFound("class", "name and source"),
  },
});

const classParam = z.object({ className: z.string(), classSource: z.string() });

const subclassListResponseSchema = z.object({
  items: z.array(subclassRecordSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

const listSubclassesRoute = createRoute({
  method: "get",
  path: "/classes/{className}/{classSource}/subclasses",
  tags: ["classes"],
  summary: "List the subclasses of one class, of one edition",
  request: { params: classParam, query: listQuery },
  responses: {
    200: {
      description: "A page of subclasses, bounded by limit and offset",
      content: { "application/json": { schema: subclassListResponseSchema } },
    },
  },
});

const subclassParam = z.object({
  className: z.string(),
  classSource: z.string(),
  name: z.string(),
  source: z.string(),
});

const readSubclassRoute = createRoute({
  method: "get",
  path: "/classes/{className}/{classSource}/subclasses/{name}/{source}",
  tags: ["classes"],
  summary: "Read one subclass by its own name and source and its class's",
  request: { params: subclassParam },
  responses: {
    200: {
      description: "The subclass",
      content: { "application/json": { schema: subclassRecordSchema } },
    },
    404: notFound("subclass", "name, source, class name and class source"),
  },
});

const subclassLevelParam = z.object({
  className: z.string(),
  classSource: z.string(),
  name: z.string(),
  source: z.string(),
  level: z.coerce.number().int().min(1).max(20),
});

const readSubclassGrantsRoute = createRoute({
  method: "get",
  path: "/classes/{className}/{classSource}/subclasses/{name}/{source}/at/{level}",
  tags: ["classes"],
  summary: "Read what a subclass grants by one level",
  request: { params: subclassLevelParam },
  responses: {
    200: {
      description:
        "The resources, slots, optional features and features the subclass grants by that level. A level a subclass grants nothing at is empty arrays, not a 404.",
      content: { "application/json": { schema: classGrantsSchema } },
    },
    404: notFound("subclass", "name, source, class name and class source"),
  },
});

const CLASS_NOT_FOUND = "No class with that name and source";
const SUBCLASS_NOT_FOUND = "No subclass with that name, source, class name and class source";

export function classesRoutes(dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(listClassesRoute, (c) => {
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const classes = listClasses(dataDir, edition).map(toClassRecord);
    return c.json({
      items: classes.slice(offset, offset + limit),
      total: classes.length,
      limit,
      offset,
    });
  });

  routes.openapi(readClassRoute, (c) => {
    const { name, source } = c.req.valid("param");
    const row = getClass(dataDir, name, source);
    if (!row) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.json(toClassRecord(row), 200);
  });

  routes.openapi(readClassGrantsRoute, (c) => {
    const { name, source, level } = c.req.valid("param");
    if (!getClass(dataDir, name, source)) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.json(toGrants(level, getClassGrants(dataDir, name, source, level)), 200);
  });

  routes.openapi(readPreparedSpellCountRoute, (c) => {
    const { name, source, level } = c.req.valid("param");
    if (!getClass(dataDir, name, source)) return c.json({ error: CLASS_NOT_FOUND }, 404);
    return c.json(getPreparedSpellCount(dataDir, name, source, level), 200);
  });

  routes.openapi(listSubclassesRoute, (c) => {
    const { className, classSource } = c.req.valid("param");
    const { edition, limit = DEFAULT_LIMIT, offset = 0 } = c.req.valid("query");
    const subclasses = listSubclasses(dataDir, className, classSource, edition).map(
      toSubclassRecord,
    );
    return c.json({
      items: subclasses.slice(offset, offset + limit),
      total: subclasses.length,
      limit,
      offset,
    });
  });

  routes.openapi(readSubclassRoute, (c) => {
    const { className, classSource, name, source } = c.req.valid("param");
    const row = getSubclass(dataDir, name, source, className, classSource);
    if (!row) return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    return c.json(toSubclassRecord(row), 200);
  });

  routes.openapi(readSubclassGrantsRoute, (c) => {
    const { className, classSource, name, source, level } = c.req.valid("param");
    const subclass = getSubclass(dataDir, name, source, className, classSource);
    if (!subclass) return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    const grants = getSubclassGrants(
      dataDir,
      className,
      classSource,
      subclass.name,
      subclass.short_name,
      subclass.source,
      level,
    );
    return c.json(toGrants(level, grants), 200);
  });

  return routes;
}
