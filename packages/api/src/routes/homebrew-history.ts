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
import {
  type HomebrewDeityInput,
  type HomebrewSubclassInput,
  type HomebrewSubraceInput,
  homebrewCollectionSchema,
  homebrewHistorySchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  homebrewBackgrounds,
  homebrewClasses,
  homebrewFeats,
  homebrewItems,
  homebrewMonsters,
  homebrewRaces,
  homebrewSkills,
  homebrewSpells,
} from "../db/homebrew.ts";
import {
  findHomebrewDeity,
  findHomebrewOptionalFeature,
  findHomebrewSubclass,
  findHomebrewSubrace,
  getHomebrewBackground,
  getHomebrewClass,
  getHomebrewDeity,
  getHomebrewFeat,
  getHomebrewItem,
  getHomebrewMonster,
  getHomebrewOptionalFeature,
  getHomebrewRace,
  getHomebrewSkill,
  getHomebrewSpell,
  getHomebrewSubclass,
  getHomebrewSubrace,
  type HomebrewDb,
  insertHomebrewBackground,
  insertHomebrewClass,
  insertHomebrewDeity,
  insertHomebrewFeat,
  insertHomebrewItem,
  insertHomebrewMonster,
  insertHomebrewOptionalFeature,
  insertHomebrewRace,
  insertHomebrewSkill,
  insertHomebrewSpell,
  insertHomebrewSubclass,
  insertHomebrewSubrace,
  type NamedHomebrewTable,
} from "../db/queries/homebrew.ts";
import { catalogSkillNames } from "../db/queries/skills.ts";
import { errorSchema, notFound } from "./errors.ts";
import { claimName, holder, idParam, nameTaken, nameTakenError } from "./homebrew.ts";
import { claimDeity, deityNameTaken, deityNameTakenError } from "./homebrew-deities.ts";
import { parentEdition } from "./homebrew-subclasses.ts";
import { raceEdition } from "./homebrew-subraces.ts";

type Collection = z.infer<typeof homebrewCollectionSchema>;
type Row = {
  id: string;
  name: string;
  /** Absent on a deity, which belongs to neither ruleset. */
  edition?: "classic" | "one";
  json: object;
  /** Where the row's parent is named outside its entry, as a subclass's class is. */
  parent?: object;
};

interface Kind {
  noun: string;
  get: (db: HomebrewDb, id: string) => Row | undefined;
  insert: (db: HomebrewDb, id: string, input: never) => unknown;
  /** The row already holding `input`'s name, where a restore would collide. */
  holder: (db: HomebrewDb, input: never) => () => NameHolder | undefined;
  /** Why `input` cannot be restored whatever its name, such as a parent class since deleted. */
  blocked?: (db: HomebrewDb, dataDir: string, input: never) => string | undefined;
  /** The edition a restore takes now, where it follows a parent that may have changed since. */
  editionNow?: (db: HomebrewDb, dataDir: string, input: never) => Row["edition"] | undefined;
}

type NameHolder = { id: string; name: string; edition: NonNullable<Row["edition"]> };

const named = (
  noun: string,
  table: NamedHomebrewTable,
  get: Kind["get"],
  insert: Kind["insert"],
): Kind => ({
  noun,
  get,
  insert,
  holder: (db, input: { name: string; edition: "classic" | "one" }) => holder(db, table, input),
});

const KINDS: Record<Collection, Kind> = {
  items: named("item", homebrewItems, getHomebrewItem, insertHomebrewItem),
  spells: named("spell", homebrewSpells, getHomebrewSpell, insertHomebrewSpell),
  races: named("race", homebrewRaces, getHomebrewRace, insertHomebrewRace),
  classes: named("class", homebrewClasses, getHomebrewClass, insertHomebrewClass),
  subclasses: {
    noun: "subclass",
    get: getHomebrewSubclass,
    insert: insertHomebrewSubclass,
    holder: (db, input: { name: string; parent: HomebrewSubclassInput["parent"] }) => () =>
      findHomebrewSubclass(db, input.parent, input.name),
    blocked: (db, dataDir, input: { parent: HomebrewSubclassInput["parent"] }) =>
      parentEdition(db, dataDir, input.parent) ? undefined : "Its class no longer exists.",
    editionNow: (db, dataDir, input: { parent: HomebrewSubclassInput["parent"] }) =>
      parentEdition(db, dataDir, input.parent),
  },
  subraces: {
    noun: "subrace",
    get: getHomebrewSubrace,
    insert: insertHomebrewSubrace,
    holder: (db, input: { name: string; parent: HomebrewSubraceInput["parent"] }) => () =>
      findHomebrewSubrace(db, input.parent, input.name),
    blocked: (db, dataDir, input: { parent: HomebrewSubraceInput["parent"] }) =>
      raceEdition(db, dataDir, input.parent) ? undefined : "Its race no longer exists.",
    editionNow: (db, dataDir, input: { parent: HomebrewSubraceInput["parent"] }) =>
      raceEdition(db, dataDir, input.parent),
  },
  backgrounds: named(
    "background",
    homebrewBackgrounds,
    getHomebrewBackground,
    insertHomebrewBackground,
  ),
  feats: named("feat", homebrewFeats, getHomebrewFeat, insertHomebrewFeat),
  monsters: named("monster", homebrewMonsters, getHomebrewMonster, insertHomebrewMonster),
  skills: {
    ...named("skill", homebrewSkills, getHomebrewSkill, insertHomebrewSkill),
    blocked: (_db, dataDir, input: { name: string; edition: NonNullable<Row["edition"]> }) => {
      const wanted = input.name.toLowerCase();
      const catalog = catalogSkillNames(dataDir, input.edition).find(
        (each) => each.toLowerCase() === wanted,
      );
      return catalog && `${catalog} is already a skill.`;
    },
  },
  "optional-features": {
    noun: "optional feature",
    get: getHomebrewOptionalFeature,
    insert: insertHomebrewOptionalFeature,
    holder: (db, input: Parameters<typeof findHomebrewOptionalFeature>[1]) => () =>
      findHomebrewOptionalFeature(db, input),
  },
  deities: {
    noun: "deity",
    get: getHomebrewDeity,
    insert: insertHomebrewDeity,
    // A deity's key is its pantheon too, so a restore claims it through `claimDeity`.
    holder: () => () => undefined,
  },
};

/**
 * Marks a PUT as a revert, so the middleware clears the held version instead of replacing it.
 * Internal: only the revert route sends it, and a client's PUT that sets it merely loses its undo.
 */
const REVERT_HEADER = "x-homebrew-revert";

const rowParams = idParam.extend({ collection: homebrewCollectionSchema });

/** The input that would save `row` as it stands: its entry without the stamped source. */
function inputOf({ json, edition, parent }: Row) {
  const { source: _source, ...entry } = json as { source?: string };
  return { ...entry, edition, ...(parent && { parent }) };
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
            deityNameTaken.content["application/json"].schema,
            errorSchema,
          ]),
        },
      },
    },
  },
});

/** The deity already holding `input`'s name and pantheon, or `undefined` once it is back under `id`. */
function restoreDeity(db: HomebrewDb, id: string, input: HomebrewDeityInput) {
  const result = claimDeity(
    () => insertHomebrewDeity(db, id, input),
    () => findHomebrewDeity(db, input),
  );
  return "taken" in result ? result.taken : undefined;
}

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
    if (collection === "deities") {
      const taken = restoreDeity(db, id, gone.input as HomebrewDeityInput);
      if (taken) return c.json(deityNameTakenError(taken), 409);
      deleted.delete(key);
      return c.body(null, 204);
    }
    const input = gone.input as { name: string; edition: NonNullable<Row["edition"]> };
    const blocked = kind.blocked?.(db, dataDir, gone.input as never);
    if (blocked) return c.json({ error: blocked }, 409);
    const restored = {
      ...input,
      edition: kind.editionNow?.(db, dataDir, gone.input as never) ?? input.edition,
    };
    const result = claimName(
      () => kind.insert(db, id, restored as never),
      kind.holder(db, restored as never),
    );
    if ("taken" in result) {
      return c.json(nameTakenError(`homebrew ${kind.noun}`, result.taken), 409);
    }
    deleted.delete(key);
    return c.body(null, 204);
  });

  return routes;
}
