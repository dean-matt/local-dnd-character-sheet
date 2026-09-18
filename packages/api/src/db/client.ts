/**
 * Opens the two user databases, backs each up, and brings it to its latest migration.
 *
 * Everything that reads or writes `characters.db` or `homebrew.db` goes through
 * `openDatabases`, because SQLite leaves `PRAGMA foreign_keys` OFF by default:
 * opened any other way, every `onDelete: "cascade"` in the schemas is silently
 * inert and deleting a character orphans its state, overrides and logs.
 *
 * Migrating on open means an API start can never skip a pending schema change,
 * unlike a documented manual step. The backup runs first and unconditionally: a
 * failed backup throws before `migrate*` runs, so a migration never proceeds
 * without a way back. `openDatabases` takes the directory rather than reading one
 * from module scope, so a test brings up its own pair at a path it controls
 * instead of touching the user's real data — this module has no top-level side
 * effect, so importing it for the function alone opens nothing. `./singleton.ts`
 * is the one place that opens the user's own.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { backupDatabase } from "./backup.ts";
import * as charactersSchema from "./characters.ts";
import * as homebrewSchema from "./homebrew.ts";
import { migrateCharacters, migrateHomebrew } from "./migrate.ts";

function open(dataDir: string, fileName: string) {
  const path = join(dataDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

/**
 * Closes the handle it just opened before rethrowing a backup or migration failure —
 * `openDatabases` never returns it on that path, so nothing else can.
 */
function openMigrated<Schema extends Record<string, unknown>>(
  dataDir: string,
  backupDir: string,
  fileName: string,
  name: string,
  schema: Schema,
  migrate: (db: BetterSQLite3Database<Schema>) => void,
) {
  const sqlite = open(dataDir, fileName);
  try {
    backupDatabase(sqlite, backupDir, name);
    const db = drizzle(sqlite, { schema });
    migrate(db);
    return db;
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

export function openDatabases(dataDir: string) {
  const backupDir = join(dataDir, "backups");

  const charactersDb = openMigrated(
    dataDir,
    backupDir,
    "characters.db",
    "characters",
    charactersSchema,
    migrateCharacters,
  );
  const homebrewDb = openMigrated(
    dataDir,
    backupDir,
    "homebrew.db",
    "homebrew",
    homebrewSchema,
    migrateHomebrew,
  );

  return { charactersDb, homebrewDb };
}
