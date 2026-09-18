import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { characterState, characters } from "./characters.ts";
import { openDatabases } from "./client.ts";

describe("openDatabases", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "db-client-"));
    opened = openDatabases(dataDir);
  });

  afterEach(() => {
    // Windows keeps the file locked until the handle closes, and rmSync then fails.
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("opens both databases at the given directory, migrated and ready to query", () => {
    const { charactersDb, homebrewDb } = opened;

    expect(charactersDb.select().from(characters).all()).toEqual([]);
    expect(homebrewDb.$client.name).toContain(dataDir);
  });

  it("enforces the cascade from character to character_state, which foreign_keys off would leave orphaned", () => {
    const { charactersDb } = opened;

    charactersDb
      .insert(characters)
      .values({
        id: "1",
        name: "Rian",
        edition: "classic",
        level: 1,
        definition: {},
      })
      .run();
    charactersDb.insert(characterState).values({ characterId: "1", state: {} }).run();

    charactersDb.delete(characters).where(eq(characters.id, "1")).run();

    expect(charactersDb.select().from(characterState).all()).toEqual([]);
  });
});

describe("openDatabases backup", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "db-client-backup-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("backs up each database before migrating it", () => {
    const opened = openDatabases(dataDir);
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();

    const backups = readdirSync(join(dataDir, "backups"));
    expect(backups.some((f) => f.startsWith("characters-"))).toBe(true);
    expect(backups.some((f) => f.startsWith("homebrew-"))).toBe(true);
  });

  it("refuses to migrate when it cannot write a backup", () => {
    writeFileSync(join(dataDir, "backups"), "blocking the path a backup directory needs");

    expect(() => openDatabases(dataDir)).toThrow();

    const sqlite = new Database(join(dataDir, "characters.db"));
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    sqlite.close();

    expect(tables).toEqual([]);
  });
});
