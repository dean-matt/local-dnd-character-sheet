import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defaultCharacterState } from "@dnd/character";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateCharacters, migrateHomebrew } from "./migrate.ts";
import { presetPageRows } from "./queries/pages.ts";

const CHARACTERS_MIGRATIONS = resolve(import.meta.dirname, "../../drizzle/characters");

/**
 * A `characters` migrations folder holding the migrations up to and including `last`, so
 * a test can put a database through them alone and then hand the same database to
 * `migrateCharacters` — the way a real upgrade reaches a backfill with existing rows
 * already in place, rather than on a database empty enough for it to be a no-op.
 */
function stageMigrationsThrough(last: string): string {
  const staged = mkdtempSync(join(tmpdir(), `characters-migrations-${last}-`));
  mkdirSync(join(staged, "meta"));
  const journal = JSON.parse(
    readFileSync(join(CHARACTERS_MIGRATIONS, "meta/_journal.json"), "utf8"),
  );
  const cut = journal.entries.findIndex((e: { tag: string }) => e.tag === last);
  const entries = journal.entries.slice(0, cut + 1);
  for (const { tag } of entries) {
    writeFileSync(
      join(staged, `${tag}.sql`),
      readFileSync(join(CHARACTERS_MIGRATIONS, `${tag}.sql`)),
    );
  }
  writeFileSync(join(staged, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
  return staged;
}

/** A character row written straight to SQL, as one left over from an earlier schema. */
function insertBareCharacter(sqlite: Database.Database, id: string) {
  sqlite
    .prepare("INSERT INTO characters (id, name, edition, level, definition) VALUES (?, ?, ?, ?, ?)")
    .run(id, "Vex", "one", 1, "{}");
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
        "character_pages",
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
    const staged = stageMigrationsThrough("0000_far_forge");
    migrate(db, { migrationsFolder: staged });
    rmSync(staged, { recursive: true, force: true });

    insertBareCharacter(sqlite, "1");

    migrateCharacters(db);

    const row = sqlite
      .prepare("SELECT state FROM character_state WHERE character_id = ?")
      .get("1") as { state: string } | undefined;
    expect(row && JSON.parse(row.state)).toEqual(defaultCharacterState());
  });

  it("backfills the preset pages for a character left over from before character_pages existed", () => {
    sqlite = new Database(join(workspace, "characters.db"));
    const db = drizzle(sqlite);
    const staged = stageMigrationsThrough("0002_optimal_naoko");
    migrate(db, { migrationsFolder: staged });
    rmSync(staged, { recursive: true, force: true });

    insertBareCharacter(sqlite, "1");

    migrateCharacters(db);

    const rows = sqlite
      .prepare(
        "SELECT character_id AS characterId, slug, title, position, hidden, preset, blocks FROM character_pages ORDER BY position",
      )
      .all() as { hidden: number; preset: number; blocks: string }[];
    expect(
      rows.map((row) => ({
        ...row,
        hidden: row.hidden === 1,
        preset: row.preset === 1,
        blocks: JSON.parse(row.blocks),
      })),
    ).toEqual(presetPageRows("1"));
  });
});
