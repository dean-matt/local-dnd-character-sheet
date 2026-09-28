/**
 * Gives a test its own in-memory `characters.db` and `homebrew.db`, each a fresh copy of
 * one image, so no test sees another's writes. The image is migrated the first time a
 * test file asks; Vitest isolates each file's modules, so that happens once per file.
 *
 * Opening them on disk runs the backup and every migration and leaves files to delete,
 * which on a hosted Windows runner costs more than the tests' own work. `client.test.ts`
 * still covers `openDatabases` on disk; this skips only what that covers, the backup and
 * WAL, and keeps its foreign keys and migrations.
 */
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as charactersSchema from "./characters.ts";
import * as homebrewSchema from "./homebrew.ts";
import { migrateCharacters, migrateHomebrew } from "./migrate.ts";

function withForeignKeys(sqlite: Database.Database) {
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

function migratedImage<Schema extends Record<string, unknown>>(
  schema: Schema,
  migrate: (db: BetterSQLite3Database<Schema>) => void,
) {
  const sqlite = withForeignKeys(new Database(":memory:"));
  migrate(drizzle(sqlite, { schema }));
  const image = sqlite.serialize();
  sqlite.close();
  return image;
}

let images: { characters: Buffer; homebrew: Buffer } | undefined;

export function openTestDatabases() {
  images ??= {
    characters: migratedImage(charactersSchema, migrateCharacters),
    homebrew: migratedImage(homebrewSchema, migrateHomebrew),
  };
  return {
    charactersDb: drizzle(withForeignKeys(new Database(images.characters)), {
      schema: charactersSchema,
    }),
    homebrewDb: drizzle(withForeignKeys(new Database(images.homebrew)), {
      schema: homebrewSchema,
    }),
  };
}
