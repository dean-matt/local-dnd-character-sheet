import type { CatalogSource } from "@dnd/catalog";
import type Database from "better-sqlite3";
import { openContentDb } from "../content.ts";

export type CatalogMetaRow = { key: string; value: string };

const UPSTREAM_TAG_KEY = "upstream_tag";

/** `read` against `content.db`, or `undefined` when no build has written `current` yet. */
function readBuiltCatalog<T>(dataDir: string, read: (db: Database.Database) => T): T | undefined {
  let db: Database.Database;
  try {
    db = openContentDb(dataDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return read(db);
  } finally {
    db.close();
  }
}

/** `content.db`'s `meta` table — what `pnpm content:build` stamped it with. */
export function getCatalogMeta(dataDir: string): CatalogMetaRow[] | undefined {
  return readBuiltCatalog(
    dataDir,
    (db) => db.prepare("SELECT key, value FROM meta ORDER BY key").all() as CatalogMetaRow[],
  );
}

/** The catalog's upstream 5etools tag, or `undefined` before a catalog has been built. */
export function getCatalogVersion(dataDir: string): string | undefined {
  return getCatalogMeta(dataDir)?.find((row) => row.key === UPSTREAM_TAG_KEY)?.value;
}

/**
 * Each source's title and group, from the book and adventure rows in `entities`. Where
 * both indexes name a source, such as `MOT`, the book wins: the adventure is a chapter of it.
 */
export function getCatalogSources(dataDir: string): CatalogSource[] | undefined {
  return readBuiltCatalog(dataDir, (db) => {
    const rows = db
      .prepare(
        `SELECT source, name,
                CASE type WHEN 'adventure' THEN 'adventure' ELSE json_extract(json, '$.group') END AS "group"
         FROM entities WHERE type IN ('book', 'adventure')
         ORDER BY source, type = 'book' DESC, name`,
      )
      .all() as CatalogSource[];
    return rows.filter((row, i) => i === 0 || rows[i - 1]?.source !== row.source);
  });
}
