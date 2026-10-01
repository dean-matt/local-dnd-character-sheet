import type Database from "better-sqlite3";
import { openContentDb } from "../content.ts";

export type CatalogMetaRow = { key: string; value: string };

const UPSTREAM_TAG_KEY = "upstream_tag";

/**
 * `content.db`'s `meta` table — what `pnpm content:build` stamped it with — or `undefined`
 * when no build has ever run and `data/content/current` does not exist yet.
 */
export function getCatalogMeta(dataDir: string): CatalogMetaRow[] | undefined {
  let db: Database.Database;
  try {
    db = openContentDb(dataDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return db.prepare("SELECT key, value FROM meta ORDER BY key").all() as CatalogMetaRow[];
  } finally {
    db.close();
  }
}

/** The catalog's upstream 5etools tag, or `undefined` before a catalog has been built. */
export function getCatalogVersion(dataDir: string): string | undefined {
  return getCatalogMeta(dataDir)?.find((row) => row.key === UPSTREAM_TAG_KEY)?.value;
}
