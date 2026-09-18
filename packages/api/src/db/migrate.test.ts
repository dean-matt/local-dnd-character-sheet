import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defaultCharacterState } from "@dnd/character";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateCharacters, migrateHomebrew } from "./migrate.ts";

const CHARACTERS_MIGRATIONS = resolve(import.meta.dirname, "../../drizzle/characters");
const TABLES_MIGRATION = join(CHARACTERS_MIGRATIONS, "0000_far_forge.sql");
const BACKFILL_MIGRATION = join(CHARACTERS_MIGRATIONS, "0001_backfill_character_state.sql");

function tableNames(sqlite: Database.Database) {
  return sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => (row as { name: string }).name);
}

describe("migrations", () => {
  let workspace: string;
  let sqlite: Database.Database;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "db-migrate-"));
  });

  afterEach(() => {
    // Windows keeps the file locked until the handle closes, and rmSync then fails.
    sqlite.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("creates every table characters.ts defines", () => {
    sqlite = new Database(join(workspace, "characters.db"));
    migrateCharacters(drizzle(sqlite));

    expect(tableNames(sqlite)).toEqual(
      expect.arrayContaining([
        "characters",
        "character_state",
        "field_overrides",
        "roll_log",
        "undo_log",
      ]),
    );
  });

  it("creates every table homebrew.ts defines", () => {
    sqlite = new Database(join(workspace, "homebrew.db"));
    migrateHomebrew(drizzle(sqlite));

    expect(tableNames(sqlite)).toEqual(
      expect.arrayContaining(["homebrew_items", "homebrew_spells"]),
    );
  });

  it("migrating twice is a no-op", () => {
    sqlite = new Database(join(workspace, "characters.db"));
    const db = drizzle(sqlite);
    migrateCharacters(db);
    const tables = tableNames(sqlite);

    expect(() => migrateCharacters(db)).not.toThrow();
    expect(tableNames(sqlite)).toEqual(tables);
  });

  it("backfills a default state for a character left over from before character_state existed", () => {
    sqlite = new Database(join(workspace, "characters.db"));
    sqlite.exec(readFileSync(TABLES_MIGRATION, "utf8"));
    sqlite
      .prepare(
        "INSERT INTO characters (id, name, edition, level, definition) VALUES (?, ?, ?, ?, ?)",
      )
      .run("1", "Vex", "one", 1, "{}");

    sqlite.exec(readFileSync(BACKFILL_MIGRATION, "utf8"));

    const row = sqlite
      .prepare("SELECT state FROM character_state WHERE character_id = ?")
      .get("1") as { state: string } | undefined;
    expect(row && JSON.parse(row.state)).toEqual(defaultCharacterState());
  });
});
