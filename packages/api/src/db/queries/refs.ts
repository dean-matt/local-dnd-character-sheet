/**
 * Resolves `{@tag}` references against `content.db`, the half of tier 2 that needs the
 * catalog: `packages/tags` returns a `ref` token and resolves nothing, so it keeps
 * depending on nothing.
 *
 * A reference matches its tag's table on `(name, source)`, ignoring case, because
 * upstream writes `{@spell fireball}` for the row `Fireball`. Where that misses,
 * upstream's own redirect map names the row a renamed entry became. What neither finds
 * resolves to `undefined`, and the renderer shows the display text unlinked.
 *
 * Source `HB` names a row of `homebrew.db` instead, by name, so a homebrew row answers
 * the same tag syntax a catalog row does. A character holds a homebrew row by id and
 * survives a rename; a tag holds the name, so a renamed or deleted row leaves it
 * unresolved.
 */
import { catalogRowEntries, type RefQuery } from "@dnd/catalog";
import type Database from "better-sqlite3";
import { openContentDb } from "../content.ts";
import {
  HOMEBREW_SOURCE,
  homebrewBackgrounds,
  homebrewClasses,
  homebrewFeats,
  homebrewItems,
  homebrewRaces,
  homebrewSpells,
} from "../homebrew.ts";
import { type HomebrewDb, homebrewNamed, type NamedHomebrewTable } from "./homebrew.ts";

/** A table row: `name`, `source` and `json`, plus any key column `path` reads. */
type Row = { name: string; source: string; json: string } & Record<string, string>;

/** A reference with its source defaulted. */
type Wanted = RefQuery & { source: string };

/**
 * How one tag finds its row. `page` is the namespace `tag_redirects` files the tag's
 * redirects under, absent where it files none. `source` is what a reference naming none
 * means: the source every sourceless reference of that tag in the corpus resolves to.
 * `bind` fills `sql`'s parameters, `(name, source)` where it is absent, and answers
 * `undefined` for a reference missing a part of the key.
 */
interface Target {
  page?: string;
  source: string;
  sql: string;
  bind?: (ref: Wanted) => (string | number)[] | undefined;
  path?: (row: Row) => string | undefined;
}

const segments = (...parts: string[]) => parts.map(encodeURIComponent).join("/");

/**
 * The address of a row `GET /catalog/{type}/{name}/{source}` reads, absent where its detail
 * would show nothing but its name.
 */
const catalogPath = (type: string) => (row: Row) =>
  catalogRowEntries(type, JSON.parse(row.json)).length > 0
    ? `/catalog/${segments(type, row.name, row.source)}`
    : undefined;

// COLLATE NOCASE cannot use the BINARY primary keys, so each lookup scans its table:
// at most the 4,808 monsters, well under a millisecond apiece. A NOCASE index in
// content/src/schema.ts is the way out if a block ever resolves slowly.
const flat = (table: string, route?: string): Omit<Target, "page" | "source"> => ({
  sql: `SELECT name, source, json FROM ${table}
        WHERE name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE`,
  path: route === undefined ? undefined : (row) => `/${route}/${segments(row.name, row.source)}`,
});

const lookup = (kind: string): Omit<Target, "page" | "source"> => ({
  sql: `SELECT name, source, json FROM lookups WHERE kind = '${kind}' AND qualifier = ''
        AND name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE`,
  path: catalogPath(kind),
});

const entity = (type: string): Omit<Target, "page" | "source"> => ({
  sql: `SELECT name, source, json FROM entities WHERE type = '${type}' AND qualifier = ''
        AND name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE`,
  path: catalogPath(type),
});

/**
 * A subclass reference names the short name, and a class offers both editions of one:
 * Battle Master|PHB sits under Fighter|PHB and Fighter|XPHB alike. The class of the
 * subclass's own source is the one it was printed for.
 */
const subclass: Omit<Target, "page" | "source"> = {
  sql: `SELECT name, source, class_name, class_source, json FROM subclasses
        WHERE short_name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE
        ORDER BY class_source = source DESC, class_source LIMIT 1`,
  path: (row) =>
    `/classes/${segments(row.class_name ?? "", row.class_source ?? "", "subclasses", row.name, row.source)}`,
};

/**
 * A race reference names a race, or a subrace by its `full_name`: `Human (Keldon)`, or
 * `Elf (Zendikar; Joraga Nation)` under a race whose name already ends in parens. An
 * unnamed subrace, whose `full_name` reads `Human (Base)`, stays unresolved, because no
 * route reads a subrace without a name of its own. The source is the subrace's own; where
 * two printings of its race both hold it, the race of that source answers, as for a
 * subclass. A race row outranks a subrace of the same name.
 */
const race: Omit<Target, "page" | "source"> = {
  sql: `SELECT name, source, json, subrace, race_name, race_source FROM (
          SELECT name, source, json, '' AS subrace, '' AS race_name, '' AS race_source
          FROM races
          UNION ALL
          SELECT full_name, source, json, name, race_name, race_source
          FROM subraces WHERE name <> ''
        )
        WHERE name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE
        ORDER BY race_name <> '', race_source = source DESC, race_source LIMIT 1`,
  path: (row) =>
    row.race_name === ""
      ? `/races/${segments(row.name, row.source)}`
      : `/races/${segments(row.race_name ?? "", row.race_source ?? "", "subraces", row.subrace ?? "", row.source)}`,
};

/** A class's or a subclass's source, where a feature reference names none. */
const OWNER_SOURCE = "PHB";

/**
 * A feature is keyed by its class and level as well, and a subclass feature by its
 * subclass's short name and source, so the reference's owner fills the rest of the key.
 * Upstream files no redirects for a feature.
 */
const classFeature: Omit<Target, "page" | "source"> = {
  sql: `SELECT name, source, class_name, class_source, level, json FROM class_features
        WHERE name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE
        AND class_name = ? COLLATE NOCASE AND class_source = ? COLLATE NOCASE AND level = ?`,
  bind: ({ name, source, owner }) =>
    owner && [name, source, owner.className, owner.classSource ?? OWNER_SOURCE, owner.level],
  path: (row) =>
    `/classes/${segments(row.class_name ?? "", row.class_source ?? "", "features", row.name, row.source, String(row.level))}`,
};

const subclassFeature: Omit<Target, "page" | "source"> = {
  sql: `SELECT name, source, class_name, class_source, subclass_short_name, subclass_source,
          level, json FROM subclass_features
        WHERE name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE
        AND class_name = ? COLLATE NOCASE AND class_source = ? COLLATE NOCASE
        AND subclass_short_name = ? COLLATE NOCASE AND subclass_source = ? COLLATE NOCASE
        AND level = ?`,
  bind: ({ name, source, owner }) =>
    owner?.subclassShortName === undefined
      ? undefined
      : [
          name,
          source,
          owner.className,
          owner.classSource ?? OWNER_SOURCE,
          owner.subclassShortName,
          owner.subclassSource ?? OWNER_SOURCE,
          owner.level,
        ],
  path: (row) =>
    `/classes/${segments(row.class_name ?? "", row.class_source ?? "", "subclasses", row.subclass_short_name ?? "", row.subclass_source ?? "", "features", row.name, row.source, String(row.level))}`,
};

/**
 * The tags tier 2 resolves. A tag left out renders unlinked: a card or a deity, whose
 * token lacks its deck or pantheon, and a table, which upstream mostly writes inside
 * another entry.
 */
const TARGETS: Record<string, Target> = {
  spell: { page: "spells.html", source: "PHB", ...flat("spells", "spells") },
  item: { page: "items.html", source: "DMG", ...flat("items", "items") },
  race: { page: "races.html", source: "PHB", ...race },
  background: { page: "backgrounds.html", source: "PHB", ...flat("backgrounds", "backgrounds") },
  feat: { page: "feats.html", source: "PHB", ...flat("feats", "feats") },
  class: { page: "classes.html", source: "PHB", ...flat("classes", "classes") },
  subclass: { page: "classes.html", source: "PHB", ...subclass },
  classFeature: { source: "PHB", ...classFeature },
  subclassFeature: { source: "PHB", ...subclassFeature },
  optfeature: {
    page: "optionalfeatures.html",
    source: "PHB",
    ...flat("optional_features"),
    path: catalogPath("optfeature"),
  },
  condition: { page: "conditionsdiseases.html", source: "PHB", ...lookup("condition") },
  status: { page: "conditionsdiseases.html", source: "PHB", ...lookup("status") },
  disease: { page: "conditionsdiseases.html", source: "DMG", ...lookup("disease") },
  action: { page: "actions.html", source: "PHB", ...lookup("action") },
  variantrule: { page: "variantrules.html", source: "DMG", ...lookup("variantrule") },
  skill: { page: "skill", source: "PHB", ...lookup("skill") },
  sense: { page: "sense", source: "PHB", ...lookup("sense") },
  language: { page: "languages.html", source: "PHB", ...lookup("language") },
  itemProperty: { page: "itemProperty", source: "PHB", ...lookup("itemProperty") },
  itemMastery: { page: "itemMastery", source: "XPHB", ...lookup("itemMastery") },
  psionic: { page: "psionics.html", source: "UATheMysticClass", ...lookup("psionic") },
  creature: { page: "bestiary.html", source: "MM", ...entity("monster") },
  legroup: { page: "legroup", source: "MM", ...entity("legendaryGroup") },
  trap: { page: "trapshazards.html", source: "DMG", ...entity("trap") },
  hazard: { page: "trapshazards.html", source: "DMG", ...entity("hazard") },
  object: { page: "objects.html", source: "DMG", ...entity("object") },
  reward: { page: "rewards.html", source: "DMG", ...entity("reward") },
  deck: { page: "decks.html", source: "DMG", ...entity("deck") },
  vehicle: { page: "vehicles.html", source: "GoS", ...entity("vehicle") },
  vehupgrade: { page: "vehicles.html", source: "GoS", ...entity("vehicleUpgrade") },
  cult: { page: "cultsboons.html", source: "MTF", ...entity("cult") },
  boon: { page: "cultsboons.html", source: "MTF", ...entity("boon") },
  facility: { page: "bastions.html", source: "XDMG", ...entity("facility") },
  charoption: { page: "charcreationoptions.html", source: "MOT", ...entity("charoption") },
  recipe: { page: "recipes.html", source: "HF", ...entity("recipe") },
};

/** The namespace `tag_redirects` files `tag`'s redirects under. */
export const redirectPage = (tag: string): string | undefined => TARGETS[tag]?.page;

/** Upstream's link hash: each half URI-encoded, then lowercased, `%2B` included. */
const hash = (name: string, source: string) =>
  `${encodeURIComponent(name).toLowerCase()}_${encodeURIComponent(source).toLowerCase()}`;

function unhash(key: string): { name: string; source: string } | undefined {
  const at = key.lastIndexOf("_");
  if (at <= 0) return undefined;
  try {
    return {
      name: decodeURIComponent(key.slice(0, at)),
      source: decodeURIComponent(key.slice(at + 1)),
    };
  } catch {
    return undefined;
  }
}

/** `json` is the row's entry, parsed: `rowEntries` reads its prose from it. */
type RowJson = { entries?: unknown; entriesHigherLevel?: unknown };

export type ResolvedRow = { name: string; source: string; json: RowJson; path?: string };

type Find = (tag: string, ref: Wanted) => ResolvedRow | undefined;

/** One prepared statement per tag, prepared the first time a reference asks for it. */
function finder(db: Database.Database): Find {
  const statements = new Map<string, Database.Statement>();
  return (tag, ref) => {
    const target = TARGETS[tag];
    const params = target?.bind ? target.bind(ref) : [ref.name, ref.source];
    if (target === undefined || params === undefined) return undefined;
    let statement = statements.get(tag);
    if (statement === undefined) {
      statement = db.prepare(target.sql);
      statements.set(tag, statement);
    }
    const row = statement.get(...params) as Row | undefined;
    if (row === undefined) return undefined;
    return {
      name: row.name,
      source: row.source,
      json: JSON.parse(row.json),
      path: target.path?.(row),
    };
  };
}

/**
 * Where upstream's redirect map sends `(name, source)` filed under `page`, one hop. The
 * target is lowercased, as upstream hashes it, so a caller matches it ignoring case.
 */
export function redirects(db: Database.Database) {
  const redirect = db.prepare(
    "SELECT to_tag, to_key FROM tag_redirects WHERE tag = ? AND from_key = ?",
  );
  return (page: string, name: string, source: string) => {
    const hop = redirect.get(page, hash(name, source)) as
      | { to_tag: string; to_key: string }
      | undefined;
    const to = hop && unhash(hop.to_key);
    return hop && to && { page: hop.to_tag, ...to };
  };
}

/**
 * A redirect is followed into whichever resolvable tag shares the page it lands on —
 * `{@action shove|PHB}` lands in `variantrules.html` as the 2024 Unarmed Strike.
 */
function redirector(db: Database.Database, find: Find) {
  const hop = redirects(db);
  return (page: string, name: string, source: string): ResolvedRow | undefined => {
    const to = hop(page, name, source);
    if (to === undefined) return undefined;
    for (const [candidate, target] of Object.entries(TARGETS)) {
      const row =
        target.page === to.page
          ? find(candidate, { tag: candidate, name: to.name, source: to.source })
          : undefined;
      if (row !== undefined) return row;
    }
    return undefined;
  };
}

/**
 * The tags a homebrew row answers. A tag names no edition, so where both editions hold
 * the name the classic row answers, the way a sourceless catalog reference defaults to a
 * classic source. An edition on the request is the way out once a block knows its own.
 */
const HOMEBREW: Record<string, { collection: string; table: NamedHomebrewTable }> = {
  item: { collection: "items", table: homebrewItems },
  spell: { collection: "spells", table: homebrewSpells },
  race: { collection: "races", table: homebrewRaces },
  background: { collection: "backgrounds", table: homebrewBackgrounds },
  feat: { collection: "feats", table: homebrewFeats },
  class: { collection: "classes", table: homebrewClasses },
};

function homebrewRow(db: HomebrewDb, tag: string, name: string): ResolvedRow | undefined {
  const target = HOMEBREW[tag];
  if (target === undefined) return undefined;
  const row = homebrewNamed(db, target.table, name);
  if (row === undefined) return undefined;
  return {
    name: row.name,
    source: HOMEBREW_SOURCE,
    json: row.json,
    path: `/homebrew/${target.collection}/${segments(row.id)}`,
  };
}

/** Every reference over one connection, answered in order. */
export function resolveRefs(
  dataDir: string,
  homebrewDb: HomebrewDb,
  refs: readonly RefQuery[],
): (ResolvedRow | undefined)[] {
  if (refs.length === 0) return [];
  const db = openContentDb(dataDir);
  try {
    const find = finder(db);
    const follow = redirector(db, find);
    return refs.map((ref) => {
      const target = TARGETS[ref.tag];
      if (target === undefined) return undefined;
      const wanted = { ...ref, source: ref.source ?? target.source };
      if (wanted.source.toUpperCase() === HOMEBREW_SOURCE) {
        return homebrewRow(homebrewDb, ref.tag, ref.name);
      }
      return (
        find(ref.tag, wanted) ??
        (target.page === undefined ? undefined : follow(target.page, ref.name, wanted.source))
      );
    });
  } finally {
    db.close();
  }
}
