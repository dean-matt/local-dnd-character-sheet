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
import type { RefQuery } from "@dnd/catalog";
import type Database from "better-sqlite3";
import { openContentDb } from "../content.ts";
import { HOMEBREW_SOURCE } from "../homebrew.ts";
import { type HomebrewDb, homebrewItemNamed, homebrewSpellNamed } from "./homebrew.ts";

/** A table row: `name`, `source` and `json`, plus any key column `path` reads. */
type Row = { name: string; source: string; json: string } & Record<string, string>;

/**
 * How one tag finds its row. `page` is the namespace `tag_redirects` files the tag's
 * redirects under. `source` is what a reference naming none means: the source every
 * sourceless reference of that tag in the corpus resolves to.
 */
interface Target {
  page: string;
  source: string;
  sql: string;
  path?: (row: Row) => string;
}

const segments = (...parts: string[]) => parts.map(encodeURIComponent).join("/");

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
});

const entity = (type: string): Omit<Target, "page" | "source"> => ({
  sql: `SELECT name, source, json FROM entities WHERE type = '${type}' AND qualifier = ''
        AND name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE`,
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
 * The tags tier 2 resolves. A tag left out renders unlinked: a feature, whose token lacks
 * the class and level that identify it; a card or a deity, which lacks its deck or
 * pantheon; and a table, which upstream mostly writes inside another entry.
 */
const TARGETS: Record<string, Target> = {
  spell: { page: "spells.html", source: "PHB", ...flat("spells", "spells") },
  item: { page: "items.html", source: "DMG", ...flat("items", "items") },
  race: { page: "races.html", source: "PHB", ...flat("races", "races") },
  background: { page: "backgrounds.html", source: "PHB", ...flat("backgrounds", "backgrounds") },
  feat: { page: "feats.html", source: "PHB", ...flat("feats", "feats") },
  class: { page: "classes.html", source: "PHB", ...flat("classes", "classes") },
  subclass: { page: "classes.html", source: "PHB", ...subclass },
  optfeature: { page: "optionalfeatures.html", source: "PHB", ...flat("optional_features") },
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

type Find = (tag: string, name: string, source: string) => ResolvedRow | undefined;

/** One prepared statement per tag, prepared the first time a reference asks for it. */
function finder(db: Database.Database): Find {
  const statements = new Map<string, Database.Statement>();
  return (tag, name, source) => {
    const target = TARGETS[tag];
    if (target === undefined) return undefined;
    let statement = statements.get(tag);
    if (statement === undefined) {
      statement = db.prepare(target.sql);
      statements.set(tag, statement);
    }
    const row = statement.get(name, source) as Row | undefined;
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
 * A redirect is followed one hop, into whichever resolvable tag shares the page it lands
 * on — `{@action shove|PHB}` lands in `variantrules.html` as the 2024 Unarmed Strike.
 */
function redirector(db: Database.Database, find: Find) {
  const redirect = db.prepare(
    "SELECT to_tag, to_key FROM tag_redirects WHERE tag = ? AND from_key = ?",
  );
  return (page: string, name: string, source: string): ResolvedRow | undefined => {
    const hop = redirect.get(page, hash(name, source)) as
      | { to_tag: string; to_key: string }
      | undefined;
    const to = hop === undefined ? undefined : unhash(hop.to_key);
    if (hop === undefined || to === undefined) return undefined;
    for (const [candidate, target] of Object.entries(TARGETS)) {
      const row = target.page === hop.to_tag ? find(candidate, to.name, to.source) : undefined;
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
const HOMEBREW: Record<
  string,
  { collection: string; named: typeof homebrewItemNamed | typeof homebrewSpellNamed }
> = {
  item: { collection: "items", named: homebrewItemNamed },
  spell: { collection: "spells", named: homebrewSpellNamed },
};

function homebrewRow(db: HomebrewDb, tag: string, name: string): ResolvedRow | undefined {
  const target = HOMEBREW[tag];
  const row = target?.named(db, name);
  if (target === undefined || row === undefined) return undefined;
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
    return refs.map(({ tag, name, source }) => {
      const target = TARGETS[tag];
      if (target === undefined) return undefined;
      const wanted = source ?? target.source;
      if (wanted.toUpperCase() === HOMEBREW_SOURCE) return homebrewRow(homebrewDb, tag, name);
      return find(tag, name, wanted) ?? follow(target.page, name, wanted);
    });
  } finally {
    db.close();
  }
}
