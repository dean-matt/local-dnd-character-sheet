/**
 * The way back from a homebrew save or delete, held in this process's memory: each row's
 * input before its latest save, and every row deleted since the API started. A restart
 * loses both, and nothing reaches `homebrew.db`.
 *
 * Mount it ahead of the kinds' routes, since its middleware records saves and deletes.
 * A revert sends the held input through the kind's own PUT, so that route's refusals (a held
 * class's hit die, a cited skill's name) apply to it unchanged. A restore inserts under the
 * row's old id, so a character still resolves it.
 */
import { homebrewCollectionSchema, homebrewHistorySchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  homebrewBackgrounds,
  homebrewClasses,
  homebrewFeats,
  homebrewItems,
  homebrewRaces,
  homebrewSkills,
  homebrewSpells,
} from "../db/homebrew.ts";
import {
  getHomebrewBackground,
  getHomebrewClass,
  getHomebrewFeat,
  getHomebrewItem,
  getHomebrewRace,
  getHomebrewSkill,
  getHomebrewSpell,
  type HomebrewDb,
  insertHomebrewBackground,
  insertHomebrewClass,
  insertHomebrewFeat,
  insertHomebrewItem,
  insertHomebrewRace,
  insertHomebrewSkill,
  insertHomebrewSpell,
  type NamedHomebrewTable,
} from "../db/queries/homebrew.ts";
import { catalogSkillNames } from "../db/queries/skills.ts";
import { errorSchema, notFound } from "./errors.ts";
import { claimName, holder, idParam, nameTaken, nameTakenError } from "./homebrew.ts";

type Collection = z.infer<typeof homebrewCollectionSchema>;
type Row = { id: string; name: string; edition: "classic" | "one"; json: object };

interface Kind {
  noun: string;
  table: NamedHomebrewTable;
  get: (db: HomebrewDb, id: string) => Row | undefined;
  insert: (db: HomebrewDb, id: string, input: never) => unknown;
}

const KINDS: Record<Collection, Kind> = {
  items: { noun: "item", table: homebrewItems, get: getHomebrewItem, insert: insertHomebrewItem },
  spells: {
    noun: "spell",
    table: homebrewSpells,
    get: getHomebrewSpell,
    insert: insertHomebrewSpell,
  },
  races: { noun: "race", table: homebrewRaces, get: getHomebrewRace, insert: insertHomebrewRace },
  classes: {
    noun: "class",
    table: homebrewClasses,
    get: getHomebrewClass,
    insert: insertHomebrewClass,
  },
  backgrounds: {
    noun: "background",
    table: homebrewBackgrounds,
    get: getHomebrewBackground,
    insert: insertHomebrewBackground,
  },
  feats: { noun: "feat", table: homebrewFeats, get: getHomebrewFeat, insert: insertHomebrewFeat },
  skills: {
    noun: "skill",
    table: homebrewSkills,
    get: getHomebrewSkill,
    insert: insertHomebrewSkill,
  },
};

/**
 * Marks a PUT as a revert, so the middleware clears the held version instead of replacing it.
 * Internal: only the revert route sends it, and a client's PUT that sets it merely loses its undo.
 */
const REVERT_HEADER = "x-homebrew-revert";

const rowParams = idParam.extend({ collection: homebrewCollectionSchema });

/** The input that would save `row` as it stands: its entry without the stamped source. */
function inputOf({ json, edition }: Row) {
  const { source: _source, ...entry } = json as { source?: string };
  return { ...entry, edition };
}

const readHistory = createRoute({
  method: "get",
  path: "/homebrew/history",
  tags: ["homebrew"],
  summary: "List the homebrew changes that can still be undone",
  responses: {
    200: {
      description:
        "The rows whose latest save can be reverted, and the rows deleted since the API started",
      content: { "application/json": { schema: homebrewHistorySchema } },
    },
  },
});

const revertRow = createRoute({
  method: "post",
  path: "/homebrew/{collection}/{id}/revert",
  tags: ["homebrew"],
  summary: "Revert a homebrew row to the version its latest save replaced",
  request: { params: rowParams },
  responses: {
    204: { description: "The row reads as it did before its latest save" },
    404: notFound("held earlier version of that homebrew row", "id"),
    409: {
      description: "The row's own save refuses the earlier version, and the reason",
      content: { "application/json": { schema: z.looseObject({ error: z.string() }) } },
    },
  },
});

const restoreRow = createRoute({
  method: "post",
  path: "/homebrew/{collection}/{id}/restore",
  tags: ["homebrew"],
  summary: "Restore a deleted homebrew row under its old id",
  request: { params: rowParams },
  responses: {
    204: { description: "The row is back, with the fields, name and edition it had" },
    404: notFound("recently deleted homebrew row", "id"),
    409: {
      description: "Another row, or a catalog skill, holds the name",
      content: {
        "application/json": {
          schema: z.union([
            nameTaken("homebrew row").content["application/json"].schema,
            errorSchema,
          ]),
        },
      },
    },
  },
});

export function homebrewHistoryRoutes(
  db: HomebrewDb,
  dataDir: string,
  send: (path: string, init: RequestInit) => Response | Promise<Response>,
) {
  const routes = new OpenAPIHono();
  const keyOf = (collection: string, id: string) => `${collection}/${id}`;
  // Unbounded: one entry per row saved or deleted since the API started. A single user's
  // session keeps these small; cap them like `undo_log` if that stops holding.
  const earlier = new Map<string, { collection: Collection; id: string; input: object }>();
  const deleted = new Map<
    string,
    { collection: Collection; id: string; name: string; input: object; deletedAt: Date }
  >();

  routes.use("/homebrew/:collection/:id", async (c, next) => {
    const collection = homebrewCollectionSchema.safeParse(c.req.param("collection"));
    const id = c.req.param("id");
    if (!collection.success || (c.req.method !== "PUT" && c.req.method !== "DELETE")) {
      return next();
    }
    const key = keyOf(collection.data, id);
    const before = KINDS[collection.data].get(db, id);
    await next();
    if (!before) return;
    if (c.req.method === "PUT" && c.res.status === 200) {
      if (c.req.header(REVERT_HEADER)) earlier.delete(key);
      else earlier.set(key, { collection: collection.data, id, input: inputOf(before) });
    }
    if (c.req.method === "DELETE" && c.res.status === 204) {
      earlier.delete(key);
      deleted.set(key, {
        collection: collection.data,
        id,
        name: before.name,
        input: inputOf(before),
        deletedAt: new Date(),
      });
    }
  });

  routes.openapi(readHistory, (c) =>
    c.json({
      reversible: [...earlier.values()].map(({ collection, id }) => ({ collection, id })),
      deleted: [...deleted.values()]
        .map(({ collection, id, name, input, deletedAt }) => ({
          collection,
          id,
          name,
          edition: (input as Pick<Row, "edition">).edition,
          deletedAt: deletedAt.toISOString(),
        }))
        .reverse(),
    }),
  );

  routes.openapi(revertRow, async (c) => {
    const { collection, id } = c.req.valid("param");
    const held = earlier.get(keyOf(collection, id));
    if (!held) return c.json({ error: "No earlier version of this row is held" }, 404);
    const res = await send(`/homebrew/${collection}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", [REVERT_HEADER]: "1" },
      body: JSON.stringify(held.input),
    });
    if (res.ok) return c.body(null, 204);
    const body = await res.json().catch(() => ({ error: res.statusText }));
    return c.json(body, res.status === 404 ? 404 : 409);
  });

  routes.openapi(restoreRow, (c) => {
    const { collection, id } = c.req.valid("param");
    const key = keyOf(collection, id);
    const gone = deleted.get(key);
    if (!gone) return c.json({ error: "No deleted row with that id" }, 404);
    const kind = KINDS[collection];
    const input = gone.input as { name: string; edition: Row["edition"] };
    if (collection === "skills") {
      const wanted = input.name.toLowerCase();
      const catalog = catalogSkillNames(dataDir, input.edition).find(
        (each) => each.toLowerCase() === wanted,
      );
      if (catalog) return c.json({ error: `${catalog} is already a skill.` }, 409);
    }
    const result = claimName(
      () => kind.insert(db, id, input as never),
      holder(db, kind.table, input),
    );
    if ("taken" in result) {
      return c.json(nameTakenError(`homebrew ${kind.noun}`, result.taken), 409);
    }
    deleted.delete(key);
    return c.body(null, 204);
  });

  return routes;
}
