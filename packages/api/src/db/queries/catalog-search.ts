import type { CatalogSearchType } from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";
import { escapeLikeTerm, ftsPrefixQuery } from "./search-terms.ts";

export type CatalogSearchRow = {
  type: string;
  name: string;
  source: string;
  edition: Edition | null;
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
 * Searches the catalog: every Tier A table `CATALOG_SEARCH_TABLES` names, matched by a
 * substring `LIKE` over `name`, and Tier C's `entities`, matched by `entities_fts` over
 * name and rendered text. content.db carries no index spanning the sixteen Tier A
 * tables, so a search here is O(rows) per table rather than tuned ranking — an index
 * spanning the tiers is a `packages/content` change the day the scan is too slow, not an
 * API one. `type` narrows to one source across both tiers, and a caller reading `null`
 * from an `edition`-less Tier C hit is reading a row that applies to either ruleset, not
 * a hit this search failed to classify.
 */
export function searchCatalog(
  dataDir: string,
  edition: Edition,
  term: string,
  type?: string,
): CatalogSearchRow[] {
  const db = openContentDb(dataDir);
  try {
    const pattern = `%${escapeLikeTerm(term)}%`;
    const rows: CatalogSearchRow[] = [];

    for (const entry of CATALOG_SEARCH_TABLES) {
      if (type !== undefined && type !== entry.type) continue;
      const extra = entry.where ? ` AND ${entry.where}` : "";
      const tableRows = db
        .prepare(
          `SELECT name, source FROM ${entry.table}
           WHERE edition = ? AND name LIKE ? ESCAPE '!'${extra}`,
        )
        .all(edition, pattern) as { name: string; source: string }[];
      for (const row of tableRows) {
        rows.push({ type: entry.type, name: row.name, source: row.source, edition });
      }
    }

    const entityParams: unknown[] = [ftsPrefixQuery(term), edition];
    let entitySql = `
      SELECT e.type, e.name, e.source, e.edition
      FROM entities_fts f
      JOIN entities e ON e.rowid = f.rowid
      WHERE entities_fts MATCH ? AND (e.edition = ? OR e.edition IS NULL)
    `;
    if (type !== undefined) {
      entitySql += " AND e.type = ?";
      entityParams.push(type);
    }
    const entityRows = db.prepare(entitySql).all(...entityParams) as CatalogSearchRow[];
    rows.push(...entityRows);

    return rows;
  } finally {
    db.close();
  }
}

/** Every source a row `searchCatalog` reads cites, once each. */
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
