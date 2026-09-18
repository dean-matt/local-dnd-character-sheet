/**
 * Opens the two user databases and brings each to its latest migration.
 *
 * Everything that reads or writes `characters.db` or `homebrew.db` goes through
 * here, because SQLite leaves `PRAGMA foreign_keys` OFF by default: opened any
 * other way, every `onDelete: "cascade"` in the schemas is silently inert and
 * deleting a character orphans its state, overrides and logs.
 *
 * Migrating on import means an API start can never skip a pending schema change,
 * unlike a documented manual step.
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as charactersSchema from "./characters.ts";
import * as homebrewSchema from "./homebrew.ts";
import { migrateCharacters, migrateHomebrew } from "./migrate.ts";

const DATA_DIR = resolve(import.meta.dirname, "../../../../data");

function open(fileName: string) {
  const path = join(DATA_DIR, fileName);
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export const charactersDb = drizzle(open("characters.db"), { schema: charactersSchema });
migrateCharacters(charactersDb);

export const homebrewDb = drizzle(open("homebrew.db"), { schema: homebrewSchema });
migrateHomebrew(homebrewDb);
