import {
  type CatalogSearchType,
  type ItemHitFacts,
  itemHitFacts,
  ofWantedKind,
} from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";
import { escapeLikeTerm, ftsPrefixQuery } from "./search-terms.ts";

export type CatalogSearchRow = {
  type: string;
  name: string;
  source: string;
  qualifier?: string;
  parent?: { name: string; source: string };
  edition: Edition | null;
  item?: ItemHitFacts;
};

/**
 * One subclass row per `(name, source)`. A subclass sits under each printing of its class —
 * Battle Master|PHB under Fighter|PHB and Fighter|XPHB alike — and the class of its own
 * source is the one it was printed for, as `refs.ts` reads it.
 */
const ONE_SUBCLASS_EACH = `rowid = (SELECT t.rowid FROM subclasses t
  WHERE t.name = subclasses.name AND t.source = subclasses.source
  ORDER BY t.class_source = t.source DESC, t.class_source LIMIT 1)`;

/**
 * The Tier A tables a search reads. `items` narrows to the two kinds a character can own,
 * matching `listItems`, and `subclasses` to one row of each subclass, its class read into
 * `parent`.
 */
const CATALOG_SEARCH_TABLES: {
  type: CatalogSearchType;
  table: string;
  where?: string;
  parent?: string;
}[] = [
  { type: "spell", table: "spells" },
  { type: "item", table: "items", where: "kind IN ('item', 'baseitem')" },
  { type: "race", table: "races" },
  { type: "background", table: "backgrounds" },
  { type: "feat", table: "feats" },
  { type: "class", table: "classes" },
  {
    type: "subclass",
    table: "subclasses",
    where: ONE_SUBCLASS_EACH,
    parent: ", class_name AS parentName, class_source AS parentSource",
  },
  { type: "optfeature", table: "optional_features" },
];

/**
 * The Tier B kinds a search reads: the rules a reader looks up by name. The rest of
 * `lookups` names what a reference abbreviates, such as the item property `M`, and would
 * list as noise.
 */
const SEARCH_LOOKUP_KINDS = [
  "action",
  "condition",
  "deity",
  "disease",
  "itemMastery",
  "language",
  "psionic",
  "sense",
  "skill",
  "status",
  "table",
  "variantrule",
];

/**
 * What narrows a search. An absent `edition` reads both rulesets, an absent `term` lists
 * every row the rest admit, and an absent `types` reads every kind. `spellLevels` and
 * `schools` narrow spells alone, and `rarities` items alone, passing every other kind
 * through; a school is upstream's one-letter code, such as `V` for evocation, and a rarity
 * is upstream's word, such as `very rare` or `none`. `itemKinds` narrows items too, to those
 * `@dnd/catalog`'s `itemKinds` places in any one of the kinds named, and an item hit
 * carries its kinds, rarity and weapon category as `item`.
 */
export type SearchFilter = {
  edition?: Edition;
  term?: string;
  types?: readonly string[];
  spellLevels?: { min: number; max: number };
  schools?: readonly string[];
  rarities?: readonly string[];
  itemKinds?: readonly string[];
};

const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ");

/** SQL conditions and the parameters they bind, joined into one `WHERE`. */
class Conditions {
  readonly params: unknown[] = [];
  private readonly clauses: string[] = [];

  add(clause: string, ...params: unknown[]) {
    this.clauses.push(clause);
    this.params.push(...params);
  }

  get where(): string {
    return this.clauses.length > 0 ? ` WHERE ${this.clauses.join(" AND ")}` : "";
  }
}

type Db = ReturnType<typeof openContentDb>;
/** The fields an item row's hit facts read, `type` renamed so it does not shadow the hit's. */
type ItemFields = {
  itemType: string | null;
  wondrous: number | null;
  staff: number | null;
  rarity: string | null;
  weaponCategory: string | null;
};

const ITEM_FIELDS =
  ", type AS itemType, rarity, json_extract(json, '$.wondrous') AS wondrous," +
  " json_extract(json, '$.staff') AS staff, json_extract(json, '$.weaponCategory') AS weaponCategory";
type SearchTable = (typeof CATALOG_SEARCH_TABLES)[number];

function tierARows(db: Db, entry: SearchTable, filter: SearchFilter): CatalogSearchRow[] {
  const { edition, term, spellLevels, schools, rarities } = filter;
  const kinds = entry.type === "item" ? filter.itemKinds : undefined;
  const conditions = new Conditions();
  if (entry.where) conditions.add(entry.where);
  if (edition !== undefined) conditions.add("edition = ?", edition);
  if (term) conditions.add("name LIKE ? ESCAPE '!'", `%${escapeLikeTerm(term)}%`);
  if (entry.type === "spell" && spellLevels !== undefined) {
    conditions.add("level BETWEEN ? AND ?", spellLevels.min, spellLevels.max);
  }
  if (entry.type === "spell" && schools?.length) {
    conditions.add(`school IN (${placeholders(schools)})`, ...schools);
  }
  if (entry.type === "item" && rarities?.length) {
    conditions.add(`rarity IN (${placeholders(rarities)})`, ...rarities);
  }
  const isItem = entry.type === "item";
  const rows = db
    .prepare(
      `SELECT name, source, edition${isItem ? ITEM_FIELDS : ""}${entry.parent ?? ""} FROM ${entry.table}${conditions.where}`,
    )
    .all(...conditions.params) as (Omit<CatalogSearchRow, "type" | "parent"> &
    Partial<ItemFields> & { parentName?: string; parentSource?: string })[];
  return rows.flatMap(
    ({ name, source, edition, itemType, parentName, parentSource, ...fields }) => {
      const hit: CatalogSearchRow = { type: entry.type, name, source, edition };
      if (parentName !== undefined && parentSource !== undefined) {
        hit.parent = { name: parentName, source: parentSource };
      }
      if (!isItem) return [hit];
      const item = itemHitFacts({ ...fields, type: itemType });
      // Kinds are read off each row rather than a column, so this scans every row the WHERE
      // admits — a few thousand at most. A content.db column is the way out the day it shows.
      return ofWantedKind(item.kinds, kinds) ? [{ ...hit, item }] : [];
    },
  );
}

type KeyedRow = Omit<CatalogSearchRow, "qualifier"> & { qualifier: string };

/** A hit carries its qualifier only where its type has one. */
const withQualifier = ({ qualifier, ...row }: KeyedRow): CatalogSearchRow =>
  qualifier === "" ? row : { ...row, qualifier };

function lookupRows(db: Db, { edition, term, types }: SearchFilter): CatalogSearchRow[] {
  const kinds = SEARCH_LOOKUP_KINDS.filter((kind) => types === undefined || types.includes(kind));
  if (kinds.length === 0) return [];
  const conditions = new Conditions();
  conditions.add(`kind IN (${placeholders(kinds)})`, ...kinds);
  if (term) conditions.add("name LIKE ? ESCAPE '!'", `%${escapeLikeTerm(term)}%`);
  if (edition !== undefined) conditions.add("(edition = ? OR edition IS NULL)", edition);
  const rows = db
    .prepare(
      `SELECT kind AS type, name, source, qualifier, edition FROM lookups${conditions.where}`,
    )
    .all(...conditions.params) as KeyedRow[];
  return rows.map(withQualifier);
}

function entityRows(db: Db, { edition, term, types }: SearchFilter): CatalogSearchRow[] {
  const conditions = new Conditions();
  if (term) conditions.add("entities_fts MATCH ?", ftsPrefixQuery(term));
  if (edition !== undefined) conditions.add("(e.edition = ? OR e.edition IS NULL)", edition);
  if (types !== undefined) conditions.add(`e.type IN (${placeholders(types)})`, ...types);
  const from = term ? "entities_fts f JOIN entities e ON e.rowid = f.rowid" : "entities e";
  const rows = db
    .prepare(
      `SELECT e.type, e.name, e.source, e.qualifier, e.edition FROM ${from}${conditions.where}`,
    )
    .all(...conditions.params) as KeyedRow[];
  return rows.map(withQualifier);
}

/**
 * Searches the catalog: every Tier A table `CATALOG_SEARCH_TABLES` names and each Tier B
 * kind `SEARCH_LOOKUP_KINDS` names, matched by a substring `LIKE` over `name`, and Tier C's
 * `entities`, matched by `entities_fts` over name and rendered text. content.db carries no
 * index spanning the tiers, so a search here is O(rows) per table rather than tuned
 * ranking — such an index is a `packages/content` change the day the scan is too slow, not
 * an API one. `types` narrows across every tier, and a caller reading `null` from an
 * `edition`-less Tier B or C hit is reading a row that applies to either ruleset, not a hit
 * this search failed to classify.
 */
export function searchCatalog(dataDir: string, filter: SearchFilter): CatalogSearchRow[] {
  const db = openContentDb(dataDir);
  try {
    return [
      ...CATALOG_SEARCH_TABLES.filter(
        ({ type }) => filter.types === undefined || filter.types.includes(type),
      ).flatMap((entry) => tierARows(db, entry, filter)),
      ...lookupRows(db, filter),
      ...entityRows(db, filter),
    ];
  } finally {
    db.close();
  }
}

/**
 * Each kind of row `searchCatalog` reads: every Tier A type, then each Tier B kind and each
 * type `entities` holds.
 */
export function listSearchTypes(dataDir: string): string[] {
  const db = openContentDb(dataDir);
  try {
    const held = db
      .prepare(
        `SELECT DISTINCT kind FROM lookups WHERE kind IN (${placeholders(SEARCH_LOOKUP_KINDS)})
         UNION SELECT DISTINCT type FROM entities`,
      )
      .pluck()
      .all(...SEARCH_LOOKUP_KINDS) as string[];
    return [...new Set([...CATALOG_SEARCH_TABLES.map(({ type }) => type), ...held])].sort();
  } finally {
    db.close();
  }
}

/** Each source cited by a row `searchCatalog` reads, listed once. */
export function listSearchSources(dataDir: string): string[] {
  const cited = [
    ...CATALOG_SEARCH_TABLES.map(
      ({ table, where }) => `SELECT source FROM ${table}${where ? ` WHERE ${where}` : ""}`,
    ),
    `SELECT source FROM lookups WHERE kind IN (${placeholders(SEARCH_LOOKUP_KINDS)})`,
    "SELECT source FROM entities",
  ].join(" UNION ");
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT source FROM (${cited}) ORDER BY source COLLATE NOCASE`)
      .pluck()
      .all(...SEARCH_LOOKUP_KINDS) as string[];
  } finally {
    db.close();
  }
}
