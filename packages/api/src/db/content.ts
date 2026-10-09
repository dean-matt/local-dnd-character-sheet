/**
 * Opens `content.db` for one query.
 *
 * `pnpm content:build` publishes a new catalog under a content-addressed filename in
 * `<dataDir>/content/` and makes it live by rewriting the small `current` pointer file to
 * name it — never by renaming onto a database file itself, which Windows refuses when any
 * process holds it open. Opening fresh per query sidesteps staleness the same way a held
 * handle would: this reads `current` and opens whatever it names right now, so a query
 * already in flight keeps the version it opened and the next query picks up whatever
 * `current` names by then — at the cost of one open (and one tiny pointer read) per query,
 * cheap for local SQLite.
 *
 * That is only safe because `build-db.ts` never deletes a versioned database the same
 * build that stops it being current — a version survives one extra build after `current`
 * moves past it, so a query already reading the old file when a rebuild flips the pointer
 * keeps reading a file that is still there.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOG_OUT_OF_DATE } from "@dnd/catalog";
import { SCHEMA_STAMP } from "@dnd/content/schema";
import Database from "better-sqlite3";

/** Thrown by `openContentDb` for a catalog whose schema stamp is not this build's. */
export class CatalogOutOfDateError extends Error {
  constructor() {
    super(CATALOG_OUT_OF_DATE);
    this.name = "CatalogOutOfDateError";
  }
}

// A versioned database never changes once published, so a path that matched once always will.
let matchedPath: string | undefined;

function stampMatches(db: Database.Database): boolean {
  const hasMeta = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'")
    .get();
  if (!hasMeta) return false;
  return (
    db.prepare("SELECT value FROM meta WHERE key = ?").pluck().get(SCHEMA_STAMP.key) ===
    SCHEMA_STAMP.value
  );
}

/** Throws `CatalogOutOfDateError` where the database `current` names was built from another schema. */
export function openContentDb(dataDir: string): Database.Database {
  const contentDir = join(dataDir, "content");
  const current = readFileSync(join(contentDir, "current"), "utf8").trim();
  const path = join(contentDir, current);
  const db = new Database(path, { readonly: true });
  if (path === matchedPath) return db;
  if (!stampMatches(db)) {
    db.close();
    throw new CatalogOutOfDateError();
  }
  matchedPath = path;
  return db;
}

/** `CATALOG_OUT_OF_DATE` where the live catalog fails the stamp check, for a warning at start. */
export function catalogSchemaWarning(dataDir: string): string | undefined {
  try {
    openContentDb(dataDir).close();
  } catch (error) {
    if (error instanceof CatalogOutOfDateError) return error.message;
  }
  return undefined;
}
