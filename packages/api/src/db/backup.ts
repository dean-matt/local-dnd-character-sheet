/**
 * Snapshots a live SQLite database before a migration touches it.
 *
 * `VACUUM INTO` produces a consistent single file from an open database, unlike a file
 * copy of the main path, which misses commits still sitting in the `-wal` sidecar and
 * can capture a torn state. Retention is bounded at `RETAINED_BACKUPS` per database,
 * oldest pruned first, for the same reason `roll_log` and `undo_log` are bounded: this
 * is a way back from the last few migrations, not an archive.
 */
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

export const RETAINED_BACKUPS = 10;

export function backupDatabase(sqlite: Database.Database, backupDir: string, name: string) {
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(backupDir, `${name}-${stamp}.db`);
  sqlite.prepare("VACUUM INTO ?").run(dest);
  pruneBackups(backupDir, name);
  return dest;
}

function pruneBackups(backupDir: string, name: string) {
  const prefix = `${name}-`;
  const backups = readdirSync(backupDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".db"))
    .sort();
  for (const stale of backups.slice(0, Math.max(0, backups.length - RETAINED_BACKUPS))) {
    unlinkSync(join(backupDir, stale));
  }
}
