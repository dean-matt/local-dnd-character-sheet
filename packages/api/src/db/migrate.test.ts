import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateCharacters, migrateHomebrew } from "./migrate.ts";

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
});
