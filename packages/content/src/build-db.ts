/**
 * Builds `data/content.db` from the vendored 5etools data.
 *
 * The database is created from scratch every run and is never migrated — if the
 * schema changes, you rebuild. Every loader runs inside one transaction against
 * a staging file that is renamed into place only once all of them succeed, so a
 * failure leaves the previous catalog untouched rather than a half-built one.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import Database from "better-sqlite3";
import { LOADERS, type Loader, type Row } from "./load/index.ts";
import { CONTENT_SCHEMA } from "./schema.ts";
import { posix, verifyVendor } from "./sync.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const DB_PATH = join(ROOT, "data", "content.db");

export type BuildOptions = {
  vendorDir: string;
  dbPath: string;
  loaders: Loader[];
  meta: Record<string, string>;
};

function repoCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function readSources(vendorDir: string, loader: Loader): Map<string, unknown> {
  // ponytail: every matched file is parsed and held resident before the loader
  // runs, so a loader over `data/bestiary/*.json` holds the whole corpus while
  // the transaction is open. Upgrade path is a per-file callback that yields
  // rows, so only one source is live at a time.
  const sources = new Map<string, unknown>();
  for (const pattern of loader.files) {
    // A glob such as `data/*` matches the subdirectories too, and handing one to
    // readFileSync throws EISDIR from behind the loader's name.
    const matches = globSync(pattern, { cwd: vendorDir, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => posix(relative(vendorDir, join(entry.parentPath, entry.name))))
      .sort();
    if (matches.length === 0) {
      throw new Error(`no file under ${vendorDir} matches ${pattern}`);
    }
    for (const match of matches) {
      sources.set(match, JSON.parse(readFileSync(join(vendorDir, match), "utf8")));
    }
  }
  return sources;
}

function insert(db: Database.Database, table: string, rows: Row[]): void {
  if (rows.length === 0) return;
  // Rows in one batch need not agree on the optional columns — an item with no
  // rarity simply omits the key — so the statement spans their union and a key a
  // row does not carry is written as NULL rather than dropped from the insert.
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quoted = columns.map((column) => `"${column}"`).join(", ");
  const statement = db.prepare(
    `INSERT INTO "${table}" (${quoted}) VALUES (${columns.map(() => "?").join(", ")})`,
  );
  for (const row of rows) statement.run(columns.map((column) => row[column] ?? null));
}

function discard(path: string): void {
  for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Removes staging files whose build is gone. A per-process name means no run
 * cleans up after another, so a killed build would otherwise leave a catalog's
 * worth of bytes in `data/` that no later run ever reaps.
 */
function reapStaging(dbPath: string): void {
  const dir = dirname(dbPath);
  for (const file of globSync(`${basename(dbPath)}.*.incoming*`, { cwd: dir })) {
    const pid = /\.(\d+)\.incoming(?:-wal|-shm)?$/.exec(file)?.[1];
    if (!pid || (Number(pid) !== process.pid && isRunning(Number(pid)))) continue;
    rmSync(join(dir, file), { force: true });
  }
}

/** Returns the row count per table written. */
export function buildContent({
  vendorDir,
  dbPath,
  loaders,
  meta,
}: BuildOptions): Record<string, number> {
  // Per-process, so two builds cannot unlink each other's staging file and
  // rename the survivor's half-written inode into place. Concurrent runs then
  // just race to rename a complete catalog, which is harmless either way.
  const staging = `${dbPath}.${process.pid}.incoming`;
  mkdirSync(dirname(dbPath), { recursive: true });
  reapStaging(dbPath);

  const db = new Database(staging);
  const counts: Record<string, number> = {};
  try {
    db.exec(CONTENT_SCHEMA);
    const stamp = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    db.transaction(() => {
      for (const [key, value] of Object.entries(meta)) stamp.run(key, value);
      for (const loader of loaders) {
        try {
          for (const [table, rows] of Object.entries(loader.rows(readSources(vendorDir, loader)))) {
            insert(db, table, rows);
            counts[table] = (counts[table] ?? 0) + rows.length;
          }
        } catch (cause) {
          throw new Error(`Loader "${loader.name}" failed`, { cause });
        }
      }
    })();
    // The rename moves the main file alone, so a WAL that neither the checkpoint
    // nor the close drains would be left behind holding committed rows — a short
    // catalog reported as a successful build. Refuse to publish one instead.
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    if (existsSync(`${staging}-wal`)) {
      throw new Error(`${staging}-wal survived the close; refusing to publish a partial catalog`);
    }
    // renameSync replaces the target atomically, so the catalog is never missing.
    // Only a stale WAL has to go first, or SQLite would apply it to the new file.
    for (const sidecar of ["-wal", "-shm"]) rmSync(`${dbPath}${sidecar}`, { force: true });
    renameSync(staging, dbPath);
  } catch (error) {
    try {
      db.close();
    } catch {
      // Already closed, or closing is itself what failed. Either way the error
      // being thrown is the one worth reporting.
    }
    discard(staging);
    throw error;
  }
  return counts;
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === import.meta.filename
) {
  const { dir, tag } = await verifyVendor();
  const counts = buildContent({
    vendorDir: dir,
    dbPath: DB_PATH,
    loaders: LOADERS,
    meta: {
      upstream_tag: tag,
      built_at: new Date().toISOString(),
      built_by_commit: repoCommit(),
      node_version: process.version,
    },
  });

  console.log(`Built ${DB_PATH}`);
  console.log(`  upstream ${tag}, node ${process.version}`);
  if (LOADERS.length === 0) console.log("  no loaders registered — schema and meta only");
  for (const table of Object.keys(counts).sort()) console.log(`  ${table} ${counts[table]}`);
}
