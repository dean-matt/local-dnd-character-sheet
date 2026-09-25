import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backupDatabase, RETAINED_BACKUPS } from "./backup.ts";

describe("backupDatabase", () => {
  let workspace: string;
  let backupDir: string;
  let sqlite: Database.Database;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "db-backup-"));
    backupDir = join(workspace, "backups");
    sqlite = new Database(join(workspace, "characters.db"));
    sqlite.exec("CREATE TABLE characters (id TEXT PRIMARY KEY, name TEXT)");
    sqlite.prepare("INSERT INTO characters (id, name) VALUES (?, ?)").run("1", "Vex");
  });

  afterEach(() => {
    vi.useRealTimers();
    sqlite.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("snapshots the database with VACUUM INTO, restorable by opening the file directly", () => {
    const dest = backupDatabase(sqlite, backupDir, "characters");

    expect(existsSync(dest)).toBe(true);
    const restored = new Database(dest, { readonly: true });
    const row = restored.prepare("SELECT name FROM characters WHERE id = ?").get("1") as
      | { name: string }
      | undefined;
    restored.close();

    expect(row?.name).toBe("Vex");
  });

  it("keeps only the most recent RETAINED_BACKUPS files for a database", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    for (let i = 0; i < RETAINED_BACKUPS + 3; i++) {
      sqlite.prepare("INSERT INTO characters (id, name) VALUES (?, ?)").run(`gen-${i}`, "Vex");
      backupDatabase(sqlite, backupDir, "characters");
      vi.setSystemTime(new Date(Date.now() + 1000));
    }

    const backups = readdirSync(backupDir).filter((f) => f.startsWith("characters-"));
    expect(backups).toHaveLength(RETAINED_BACKUPS);
  });

  it("does not spend a retention slot backing up a database unchanged since the last backup", () => {
    backupDatabase(sqlite, backupDir, "characters");

    for (let i = 0; i < 3; i++) {
      backupDatabase(sqlite, backupDir, "characters");
    }

    const backups = readdirSync(backupDir).filter((f) => f.startsWith("characters-"));
    expect(backups).toHaveLength(1);
  });

  it("backs up twice inside one millisecond without throwing or overwriting the first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const first = backupDatabase(sqlite, backupDir, "characters");
    expect(backupDatabase(sqlite, backupDir, "characters")).toBe(first);

    sqlite.prepare("INSERT INTO characters (id, name) VALUES (?, ?)").run("2", "Pike");
    const second = backupDatabase(sqlite, backupDir, "characters");

    const backups = readdirSync(backupDir)
      .filter((f) => f.startsWith("characters-"))
      .sort();
    expect(backups.map((f) => join(backupDir, f))).toEqual([first, second]);
    const kept = new Database(first, { readonly: true });
    const count = kept.prepare("SELECT count(*) AS n FROM characters").get() as { n: number };
    kept.close();
    expect(count.n).toBe(1);
  });

  it("never prunes a different database's backups sharing the same directory", () => {
    const homebrew = new Database(join(workspace, "homebrew.db"));
    homebrew.exec("CREATE TABLE homebrew_items (id TEXT PRIMARY KEY)");

    backupDatabase(sqlite, backupDir, "characters");
    backupDatabase(homebrew, backupDir, "homebrew");
    homebrew.close();

    const backups = readdirSync(backupDir);
    expect(backups.some((f) => f.startsWith("characters-"))).toBe(true);
    expect(backups.some((f) => f.startsWith("homebrew-"))).toBe(true);
  });
});
