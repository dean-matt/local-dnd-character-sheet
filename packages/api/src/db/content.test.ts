import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openContentDb } from "./content.ts";

/** Mirrors `build-db.ts`'s publish step: write, drop WAL mode, clear old sidecars, rename. */
function publish(dbPath: string, value: string): void {
  const staging = `${dbPath}.incoming`;
  const db = new Database(staging);
  db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE meta (value TEXT)");
  db.prepare("INSERT INTO meta (value) VALUES (?)").run(value);
  db.pragma("journal_mode = DELETE");
  db.close();
  for (const sidecar of ["-wal", "-shm"]) rmSync(`${dbPath}${sidecar}`, { force: true });
  renameSync(staging, dbPath);
}

describe("openContentDb", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps reading its own snapshot when a rebuild renames a new catalog over it", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-db-"));
    const dbPath = join(dataDir, "content.db");
    publish(dbPath, "v1");

    const reader = openContentDb(dataDir);
    expect(reader.prepare("SELECT value FROM meta").get()).toEqual({ value: "v1" });

    // Stand-ins for sidecars an older build could have left behind — the rebuild's
    // cleanup removes whatever sits at the old path, and a reader already holding a
    // plain connection to that path must not notice either way.
    writeFileSync(`${dbPath}-wal`, "stale wal bytes");
    writeFileSync(`${dbPath}-shm`, "stale shm bytes");

    publish(dbPath, "v2");

    expect(reader.prepare("SELECT value FROM meta").get()).toEqual({ value: "v1" });
    reader.close();

    const fresh = openContentDb(dataDir);
    expect(fresh.prepare("SELECT value FROM meta").get()).toEqual({ value: "v2" });
    fresh.close();
  });
});
