/**
 * Gives a test its own in-memory `characters.db` and `homebrew.db`, each a copy of one
 * image migrated the first time a test file asks. Vitest isolates each test file's
 * modules, so the images are built once per file and no test sees another's writes.
 *
 * On disk, every open ran the backup and every migration and left files to delete, which
 * a hosted Windows runner made the slowest part of the suite. `openDatabases` itself keeps
 * its on-disk tests in `client.test.ts`; this skips only what those already cover, the
 * backup and WAL, and keeps its foreign keys and migrations.
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
  const t0 = performance.now();
  try {
    return openTestDatabasesTimed();
  } finally {
    const g = globalThis as unknown as { __dbTiming?: { open: number } };
    if (g.__dbTiming) g.__dbTiming.open += performance.now() - t0;
  }
}

function openTestDatabasesTimed() {
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
