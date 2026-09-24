/**
 * Read, replace and restore for a character's pages. The list is written whole, in
 * display order, so one route reorders, hides, edits, adds and removes. `preset` is
 * never accepted from a request body — the query layer carries it through every write.
 */
import {
  type CharacterPageRecord,
  characterPageRecordSchema,
  characterPagesSchema,
} from "@dnd/character";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CharactersDb } from "../db/queries/characters.ts";
import {
  listCharacterPages,
  replaceCharacterPages,
  restoreDefaultPages,
} from "../db/queries/pages.ts";
import { errorSchema, notFound } from "./errors.ts";

type PageRow = NonNullable<ReturnType<typeof listCharacterPages>>[number];

/** Validates rows read back from SQLite against the same schema their write went through. */
function toRecords(rows: PageRow[]): CharacterPageRecord[] {
  return rows.map((row) =>
    characterPageRecordSchema.parse({
      slug: row.slug,
      title: row.title,
      hidden: row.hidden,
      preset: row.preset,
      blocks: row.blocks,
    }),
  );
}

const idParam = z.object({ id: z.string() });

const NOT_FOUND = "No character with that id";

const pagesResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: z.array(characterPageRecordSchema) } },
});

const list = createRoute({
  method: "get",
  path: "/characters/{id}/pages",
  tags: ["characters"],
  summary: "List a character's pages, in display order",
  request: { params: idParam },
  responses: {
    200: pagesResponse("The character's pages"),
    404: notFound("character"),
  },
});

const replace = createRoute({
  method: "put",
  path: "/characters/{id}/pages",
  tags: ["characters"],
  summary: "Replace a character's pages, in display order",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: characterPagesSchema } } },
  },
  responses: {
    200: pagesResponse("The character's pages as written"),
    404: notFound("character"),
    409: {
      description: "The list leaves out a preset, which can be hidden but not deleted",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const restore = createRoute({
  method: "post",
  path: "/characters/{id}/pages/restore-defaults",
  tags: ["characters"],
  summary: "Restore every preset page as seeded, keeping the pages the user wrote",
  request: { params: idParam },
  responses: {
    200: pagesResponse("The character's pages after the restore"),
    404: notFound("character"),
  },
});

export function pagesRoutes(db: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(list, (c) => {
    const rows = listCharacterPages(db, c.req.valid("param").id);
    if (!rows) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toRecords(rows), 200);
  });

  routes.openapi(replace, (c) => {
    const result = replaceCharacterPages(db, c.req.valid("param").id, c.req.valid("json"));
    if (!result) return c.json({ error: NOT_FOUND }, 404);
    if ("missingPresets" in result) {
      const slugs = result.missingPresets.join(", ");
      return c.json({ error: `A preset can be hidden but not deleted: ${slugs}` }, 409);
    }
    return c.json(toRecords(result.pages), 200);
  });

  routes.openapi(restore, (c) => {
    const rows = restoreDefaultPages(db, c.req.valid("param").id);
    if (!rows) return c.json({ error: NOT_FOUND }, 404);
    return c.json(toRecords(rows), 200);
  });

  return routes;
}
