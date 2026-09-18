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

export function migrateCharacters(db: BetterSQLite3Database<Record<string, unknown>>) {
  migrate(db, { migrationsFolder: CHARACTERS_MIGRATIONS });
}

export function migrateHomebrew(db: BetterSQLite3Database<Record<string, unknown>>) {
  migrate(db, { migrationsFolder: HOMEBREW_MIGRATIONS });
}
