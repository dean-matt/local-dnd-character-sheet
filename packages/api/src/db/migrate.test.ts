import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defaultCharacterState } from "@dnd/character";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateCharacters, migrateHomebrew } from "./migrate.ts";

const CHARACTERS_MIGRATIONS = resolve(import.meta.dirname, "../../drizzle/characters");

/**
 * A `characters` migrations folder holding only `0000_far_forge.sql`, so a test can put a
 * database through it alone and then hand the same database to `migrateCharacters` — the
 * way a real upgrade reaches `0001_backfill_character_state.sql` with existing rows
 * already in place, rather than on a database empty enough for the backfill to be a no-op.
 */
function stageMigration0000(): string {
  const staged = mkdtempSync(join(tmpdir(), "characters-migrations-0000-"));
  mkdirSync(join(staged, "meta"));
  writeFileSync(
    join(staged, "0000_far_forge.sql"),
    readFileSync(join(CHARACTERS_MIGRATIONS, "0000_far_forge.sql")),
  );
  const journal = JSON.parse(
    readFileSync(join(CHARACTERS_MIGRATIONS, "meta/_journal.json"), "utf8"),
  );
  writeFileSync(
    join(staged, "meta/_journal.json"),
    JSON.stringify({
      ...journal,
      entries: journal.entries.filter((e: { tag: string }) => e.tag === "0000_far_forge"),
    }),
  );
  return staged;
}

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
    const db = drizzle(sqlite);
    const staged = stageMigration0000();
    migrate(db, { migrationsFolder: staged });
    rmSync(staged, { recursive: true, force: true });

    sqlite
      .prepare(
        "INSERT INTO characters (id, name, edition, level, definition) VALUES (?, ?, ?, ?, ?)",
      )
      .run("1", "Vex", "one", 1, "{}");

    migrateCharacters(db);

    const row = sqlite
      .prepare("SELECT state FROM character_state WHERE character_id = ?")
      .get("1") as { state: string } | undefined;
    expect(row && JSON.parse(row.state)).toEqual(defaultCharacterState());
  });
});
