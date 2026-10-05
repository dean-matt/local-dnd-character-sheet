import {
  type CatalogSearchType,
  type ItemHitFacts,
  type ItemKind,
  itemHitFacts,
} from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";
import { escapeLikeTerm, ftsPrefixQuery } from "./search-terms.ts";

export type CatalogSearchRow = {
  type: string;
  name: string;
  source: string;
  edition: Edition | null;
  item?: ItemHitFacts;
};

/**
 * The Tier A tables a search reads, each keyed by `(name, source)` alone — see
 * `@dnd/catalog`'s `CatalogSearchType` for why subclasses and subraces, whose key reaches
 * into a parent, are not among them. `items` narrows to the two kinds a character can
 * own, matching `listItems`.
 */
const CATALOG_SEARCH_TABLES: { type: CatalogSearchType; table: string; where?: string }[] = [
  { type: "spell", table: "spells" },
  { type: "item", table: "items", where: "kind IN ('item', 'baseitem')" },
  { type: "race", table: "races" },
  { type: "background", table: "backgrounds" },
  { type: "feat", table: "feats" },
  { type: "class", table: "classes" },
  { type: "optfeature", table: "optional_features" },
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

/**
 * Whether an item of `kinds` is one `wanted` admits; every item is where it names none. An
 * item's kinds are read off its fields rather than a column, so the filter scans the rows the
 * rest of the `WHERE` admits — a few thousand at most. A `content.db` column is the way out
 * the day that scan shows.
 */
export function ofWantedKind(kinds: readonly ItemKind[], wanted?: readonly string[]) {
  return !wanted?.length || kinds.some((kind) => wanted.includes(kind));
}

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
      `SELECT name, source, edition${isItem ? ITEM_FIELDS : ""} FROM ${entry.table}${conditions.where}`,
    )
    .all(...conditions.params) as (Omit<CatalogSearchRow, "type"> & Partial<ItemFields>)[];
  return rows.flatMap(({ name, source, edition, itemType, ...fields }) => {
    const hit = { type: entry.type, name, source, edition };
    if (!isItem) return [hit];
    const item = itemHitFacts({ ...fields, type: itemType });
    return ofWantedKind(item.kinds, kinds) ? [{ ...hit, item }] : [];
  });
}

function entityRows(db: Db, { edition, term, types }: SearchFilter): CatalogSearchRow[] {
  const conditions = new Conditions();
  if (term) conditions.add("entities_fts MATCH ?", ftsPrefixQuery(term));
  if (edition !== undefined) conditions.add("(e.edition = ? OR e.edition IS NULL)", edition);
  if (types !== undefined) conditions.add(`e.type IN (${placeholders(types)})`, ...types);
  const from = term ? "entities_fts f JOIN entities e ON e.rowid = f.rowid" : "entities e";
  return db
    .prepare(`SELECT e.type, e.name, e.source, e.edition FROM ${from}${conditions.where}`)
    .all(...conditions.params) as CatalogSearchRow[];
}

/**
 * Searches the catalog: every Tier A table `CATALOG_SEARCH_TABLES` names, matched by a
 * substring `LIKE` over `name`, and Tier C's `entities`, matched by `entities_fts` over
 * name and rendered text. content.db carries no index spanning the sixteen Tier A
 * tables, so a search here is O(rows) per table rather than tuned ranking — an index
 * spanning the tiers is a `packages/content` change the day the scan is too slow, not an
 * API one. `types` narrows across both tiers, and a caller reading `null` from an
 * `edition`-less Tier C hit is reading a row that applies to either ruleset, not a hit
 * this search failed to classify.
 */
export function searchCatalog(dataDir: string, filter: SearchFilter): CatalogSearchRow[] {
  const db = openContentDb(dataDir);
  try {
    return [
      ...CATALOG_SEARCH_TABLES.filter(
        ({ type }) => filter.types === undefined || filter.types.includes(type),
      ).flatMap((entry) => tierARows(db, entry, filter)),
      ...entityRows(db, filter),
    ];
  } finally {
    db.close();
  }
}

/** Each kind of row `searchCatalog` reads: every Tier A type, then each type `entities` holds. */
export function listSearchTypes(dataDir: string): string[] {
  const db = openContentDb(dataDir);
  try {
    const entityTypes = db.prepare("SELECT DISTINCT type FROM entities").pluck().all() as string[];
    return [...new Set([...CATALOG_SEARCH_TABLES.map(({ type }) => type), ...entityTypes])].sort();
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
    "SELECT source FROM entities",
  ].join(" UNION ");
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT source FROM (${cited}) ORDER BY source COLLATE NOCASE`)
      .pluck()
      .all() as string[];
  } finally {
    db.close();
  }
}
