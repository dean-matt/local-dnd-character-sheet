import { randomUUID } from "node:crypto";
import {
  type HomebrewSubclassInput,
  homebrewClassFeaturesInputSchema,
  homebrewClassFeaturesSchema,
  homebrewSubclassInputSchema,
  homebrewSubclassRecordSchema,
  sameSubclassParent,
  subclassParentLabel,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type CharactersDb, charactersReferencingHomebrew } from "../db/queries/characters.ts";
import { getClass } from "../db/queries/classes.ts";
import {
  deleteHomebrewSubclass,
  findHomebrewSubclass,
  getHomebrewClass,
  getHomebrewSubclass,
  type HomebrewDb,
  insertHomebrewSubclass,
  listHomebrewSubclasses,
  listHomebrewSubclassFeatures,
  replaceHomebrewSubclassFeatures,
  updateHomebrewSubclass,
} from "../db/queries/homebrew.ts";
import { errorSchema, notFound } from "./errors.ts";
import {
  claimName,
  idParam,
  nameTaken,
  nameTakenError,
  referenced,
  referencedError,
  toSubclassRecord,
} from "./homebrew.ts";

const SUBCLASS_NOT_FOUND = "No homebrew subclass with that id";
const CLASS_NOT_FOUND = "No class with that name and source, or homebrew class with that id";

const names = new Intl.ListFormat("en", { type: "conjunction" });

const parentHeld = (
  subclass: { name: string; className: string; classSource: string; classId: string | null },
  characters: { id: string; name: string }[],
) => {
  const parent = subclassParentLabel(subclass);
  return {
    error: `${subclass.name} is held by ${names.format(characters.map((held) => held.name))}, so it stays a subclass of ${parent}. Keep ${parent}, or add a new subclass to the other class.`,
    characters,
  };
};

const listSubclasses = createRoute({
  method: "get",
  path: "/homebrew/subclasses",
  tags: ["homebrew"],
  summary: "List every homebrew subclass",
  responses: {
    200: {
      description: "Every homebrew subclass",
      content: { "application/json": { schema: z.array(homebrewSubclassRecordSchema) } },
    },
  },
});

const readSubclass = createRoute({
  method: "get",
  path: "/homebrew/subclasses/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew subclass",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew subclass",
      content: { "application/json": { schema: homebrewSubclassRecordSchema } },
    },
    404: notFound("homebrew subclass"),
  },
});

const createSubclass = createRoute({
  method: "post",
  path: "/homebrew/subclasses",
  tags: ["homebrew"],
  summary: "Create a homebrew subclass",
  request: {
    body: { content: { "application/json": { schema: homebrewSubclassInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew subclass",
      content: { "application/json": { schema: homebrewSubclassRecordSchema } },
    },
    404: {
      description: "The parent class is neither a catalog class nor a homebrew class",
      content: { "application/json": { schema: errorSchema } },
    },
    409: nameTaken("homebrew subclass"),
  },
});

const updateSubclass = createRoute({
  method: "put",
  path: "/homebrew/subclasses/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew subclass",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewSubclassInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew subclass",
      content: { "application/json": { schema: homebrewSubclassRecordSchema } },
    },
    404: {
      description: "No homebrew subclass with that id, or the parent class does not exist",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description:
        "Another subclass of the parent class has this name, or a character holds the subclass and its parent class would change",
      content: {
        "application/json": {
          schema: z.union([
            nameTaken("homebrew subclass").content["application/json"].schema,
            referenced("homebrew subclass").content["application/json"].schema,
          ]),
        },
      },
    },
  },
});

const removeSubclass = createRoute({
  method: "delete",
  path: "/homebrew/subclasses/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew subclass",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew subclass was deleted" },
    404: notFound("homebrew subclass"),
    409: referenced("homebrew subclass"),
  },
});

const readFeatures = createRoute({
  method: "get",
  path: "/homebrew/subclasses/{id}/features",
  tags: ["homebrew"],
  summary: "List a homebrew subclass's features",
  request: { params: idParam },
  responses: {
    200: {
      description: "The subclass's features, by level then name",
      content: { "application/json": { schema: homebrewClassFeaturesSchema } },
    },
    404: notFound("homebrew subclass"),
  },
});

const replaceFeatures = createRoute({
  method: "put",
  path: "/homebrew/subclasses/{id}/features",
  tags: ["homebrew"],
  summary: "Replace a homebrew subclass's features",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewClassFeaturesInputSchema } } },
  },
  responses: {
    200: {
      description: "The subclass's features as stored",
      content: { "application/json": { schema: homebrewClassFeaturesSchema } },
    },
    404: notFound("homebrew subclass"),
  },
});

/** The edition a subclass takes from its parent class, or undefined where no such class exists. */
export function parentEdition(
  db: HomebrewDb,
  dataDir: string,
  parent: HomebrewSubclassInput["parent"],
) {
  return "classId" in parent
    ? getHomebrewClass(db, parent.classId)?.edition
    : getClass(dataDir, parent.name, parent.source)?.edition;
}

export function homebrewSubclassesRoutes(
  db: HomebrewDb,
  charactersDb: CharactersDb,
  dataDir: string,
) {
  const routes = new OpenAPIHono();

  routes.openapi(listSubclasses, (c) => c.json(listHomebrewSubclasses(db).map(toSubclassRecord)));

  routes.openapi(readSubclass, (c) => {
    const row = getHomebrewSubclass(db, c.req.valid("param").id);
    if (!row) return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    return c.json(toSubclassRecord(row), 200);
  });

  routes.openapi(readFeatures, (c) => {
    const { id } = c.req.valid("param");
    if (!getHomebrewSubclass(db, id)) return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    return c.json(listHomebrewSubclassFeatures(db, id), 200);
  });

  routes.openapi(replaceFeatures, (c) => {
    const { id } = c.req.valid("param");
    if (!getHomebrewSubclass(db, id)) return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    replaceHomebrewSubclassFeatures(db, id, c.req.valid("json"));
    return c.json(listHomebrewSubclassFeatures(db, id), 200);
  });

  routes.openapi(createSubclass, (c) => {
    const input = c.req.valid("json");
    const edition = parentEdition(db, dataDir, input.parent);
    if (!edition) return c.json({ error: CLASS_NOT_FOUND }, 404);
    const result = claimName(
      () => insertHomebrewSubclass(db, randomUUID(), { ...input, edition }),
      () => findHomebrewSubclass(db, input.parent, input.name),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew subclass", result.taken), 409);
    return c.json(toSubclassRecord(result.row), 201);
  });

  routes.openapi(updateSubclass, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const current = getHomebrewSubclass(db, id);
    if (!current) return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    const edition = parentEdition(db, dataDir, input.parent);
    if (!edition) return c.json({ error: CLASS_NOT_FOUND }, 404);
    // A holder keeps the subclass by id on a level of its own class, which a move would leave
    // holding another class's subclass. The check and the write share no transaction across
    // the two files, as with a held class's hit die.
    if (!sameSubclassParent(current.parent, input.parent)) {
      const characters = charactersReferencingHomebrew(charactersDb, id);
      if (characters.length > 0) return c.json(parentHeld(current, characters), 409);
    }
    const result = claimName(
      () => updateHomebrewSubclass(db, id, { ...input, edition }),
      () => findHomebrewSubclass(db, input.parent, input.name),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew subclass", result.taken), 409);
    if (!result.row) return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    return c.json(toSubclassRecord(result.row), 200);
  });

  routes.openapi(removeSubclass, (c) => {
    const { id } = c.req.valid("param");
    const characters = charactersReferencingHomebrew(charactersDb, id);
    if (characters.length > 0) return c.json(referencedError("This subclass", characters), 409);
    if (!deleteHomebrewSubclass(db, id)) {
      return c.json({ error: SUBCLASS_NOT_FOUND }, 404);
    }
    return c.body(null, 204);
  });

  return routes;
}
