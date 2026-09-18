/**
 * Applies pending Drizzle migrations to an already-open database.
 *
 * Holds only the migration folder paths, never a database handle, so a test can call
 * these against a database it creates without touching `data/`.
 */
import { resolve } from "node:path";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const CHARACTERS_MIGRATIONS = resolve(import.meta.dirname, "../../drizzle/characters");
const HOMEBREW_MIGRATIONS = resolve(import.meta.dirname, "../../drizzle/homebrew");

export function migrateCharacters<Schema extends Record<string, unknown>>(
  db: BetterSQLite3Database<Schema>,
) {
  migrate(db, { migrationsFolder: CHARACTERS_MIGRATIONS });
}

export function migrateHomebrew<Schema extends Record<string, unknown>>(
  db: BetterSQLite3Database<Schema>,
) {
  migrate(db, { migrationsFolder: HOMEBREW_MIGRATIONS });
}
