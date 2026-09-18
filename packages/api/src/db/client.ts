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

function openMigrated<Schema extends Record<string, unknown>>(
  dataDir: string,
  backupDir: string,
  fileName: string,
  schema: Schema,
  migrate: (db: BetterSQLite3Database<Schema>) => void,
  opened: Database.Database[],
) {
  const sqlite = open(dataDir, fileName);
  opened.push(sqlite);
  backupDatabase(sqlite, backupDir, fileName.replace(/\.db$/, ""));
  const db = drizzle(sqlite, { schema });
  migrate(db);
  return db;
}

/**
 * Closes every handle `openMigrated` opened so far before rethrowing a backup or
 * migration failure, including one from an earlier call that itself succeeded —
 * neither this function nor its caller returns them on that path, so nothing else can.
 */
export function openDatabases(dataDir: string) {
  const backupDir = join(dataDir, "backups");
  const opened: Database.Database[] = [];

  try {
    const charactersDb = openMigrated(
      dataDir,
      backupDir,
      "characters.db",
      charactersSchema,
      migrateCharacters,
      opened,
    );
    const homebrewDb = openMigrated(
      dataDir,
      backupDir,
      "homebrew.db",
      homebrewSchema,
      migrateHomebrew,
      opened,
    );

    return { charactersDb, homebrewDb };
  } catch (error) {
    for (const sqlite of opened) sqlite.close();
    throw error;
  }
}
