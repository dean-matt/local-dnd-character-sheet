import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openContentDb } from "./content.ts";

/**
 * Mirrors `build-db.ts`'s publish step: write a versioned database under its own
 * content-addressed name, then flip `current` to it. Nothing renames onto a database
 * file itself, so this never touches a path a reader might have open — the property
 * that makes the scheme work identically on Windows.
 */
function publish(contentDir: string, value: string): string {
  mkdirSync(contentDir, { recursive: true });
  const name = `content-${value}.db`;
  const target = join(contentDir, name);
  const staging = `${target}.incoming`;
  const db = new Database(staging);
  db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE meta (value TEXT)");
  db.prepare("INSERT INTO meta (value) VALUES (?)").run(value);
  db.pragma("journal_mode = DELETE");
  db.close();
  for (const sidecar of ["-wal", "-shm"]) rmSync(`${staging}${sidecar}`, { force: true });
  renameSync(staging, target);

  const tmp = join(contentDir, "current.tmp");
  writeFileSync(tmp, name);
  renameSync(tmp, join(contentDir, "current"));
  return target;
}

describe("openContentDb", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps reading its own snapshot when a rebuild points current at a new version", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-db-"));
    const contentDir = join(dataDir, "content");
    const v1 = publish(contentDir, "v1");

    const reader = openContentDb(dataDir);
    expect(reader.prepare("SELECT value FROM meta").get()).toEqual({ value: "v1" });

    // Stand-ins for sidecars an older build could have left behind — the rebuild
    // never touches this reader's file at all, since it only ever writes a new
    // name and repoints `current`, so a reader already holding a connection to the
    // old version must not notice either way.
    writeFileSync(`${v1}-wal`, "stale wal bytes");
    writeFileSync(`${v1}-shm`, "stale shm bytes");

    publish(contentDir, "v2");

    expect(reader.prepare("SELECT value FROM meta").get()).toEqual({ value: "v1" });
    reader.close();

    const fresh = openContentDb(dataDir);
    expect(fresh.prepare("SELECT value FROM meta").get()).toEqual({ value: "v2" });
    fresh.close();
  });

  it("never renames onto a path a reader could have open, unlike publishing a bare content.db", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-db-"));
    const contentDir = join(dataDir, "content");
    const v1 = publish(contentDir, "v1");
    const reader = openContentDb(dataDir);

    publish(contentDir, "v2");

    // The version the still-open reader holds is untouched: nothing was renamed
    // over it, only a new file was added and the tiny pointer file rewritten.
    expect(reader.prepare("SELECT value FROM meta").get()).toEqual({ value: "v1" });
    expect(() => new Database(v1, { readonly: true }).close()).not.toThrow();
    reader.close();
  });
});
