/**
 * Builds `data/content.db` from the vendored 5etools data.
 *
 * The database is created from scratch every run and is never migrated — if the
 * schema changes, you rebuild. Every loader runs inside one transaction against
 * a staging file that is renamed into place only once all of them succeed, so a
 * failure leaves the previous catalog untouched rather than a half-built one.
 */
import { execFileSync } from "node:child_process";
import { existsSync, globSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { LOADERS, type Loader, type Row } from "./load/index.ts";
import { CONTENT_SCHEMA } from "./schema.ts";
import { posix, verifyVendor } from "./sync.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const DB_PATH = join(ROOT, "data", "content.db");
const LOCKFILE = join(ROOT, "content.lock.json");

export type BuildOptions = {
  vendorDir: string;
  dbPath: string;
  loaders: Loader[];
  meta: Record<string, string>;
};

function upstreamTag(): string {
  if (!existsSync(LOCKFILE)) {
    throw new Error("No content.lock.json. Run `pnpm content:sync` first.");
  }
  return JSON.parse(readFileSync(LOCKFILE, "utf8")).tag;
}

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
  const sources = new Map<string, unknown>();
  for (const pattern of loader.files) {
    const matches = globSync(pattern, { cwd: vendorDir }).sort();
    if (matches.length === 0) {
      throw new Error(`no file under ${vendorDir} matches ${pattern}`);
    }
    for (const match of matches) {
      sources.set(posix(match), JSON.parse(readFileSync(join(vendorDir, match), "utf8")));
    }
  }
  return sources;
}

function insert(db: Database.Database, table: string, rows: Row[]): void {
  const [first] = rows;
  if (!first) return;
  const columns = Object.keys(first);
  const statement = db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
  );
  for (const row of rows) statement.run(columns.map((column) => row[column]));
}

function discard(path: string): void {
  for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
}

/** Returns the row count per table written. */
export function buildContent({
  vendorDir,
  dbPath,
  loaders,
  meta,
}: BuildOptions): Record<string, number> {
  const staging = `${dbPath}.incoming`;
  mkdirSync(dirname(dbPath), { recursive: true });
  discard(staging);

  const db = new Database(staging);
  const counts: Record<string, number> = {};
  try {
    db.exec(CONTENT_SCHEMA);
    const stamp = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    db.transaction(() => {
      for (const [key, value] of Object.entries(meta)) stamp.run(key, value);
      for (const loader of loaders) {
        let tables: Record<string, Row[]>;
        try {
          tables = loader.rows(readSources(vendorDir, loader));
        } catch (cause) {
          throw new Error(`Loader "${loader.name}" failed`, { cause });
        }
        for (const [table, rows] of Object.entries(tables)) {
          insert(db, table, rows);
          counts[table] = (counts[table] ?? 0) + rows.length;
        }
      }
    })();
  } catch (error) {
    db.close();
    discard(staging);
    throw error;
  }
  db.close();
  discard(dbPath);
  renameSync(staging, dbPath);
  return counts;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const tag = upstreamTag();
  const counts = buildContent({
    vendorDir: await verifyVendor(),
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
  const tables = Object.keys(counts).sort();
  if (tables.length === 0) console.log("  no loaders registered — schema and meta only");
  for (const table of tables) console.log(`  ${table} ${counts[table]}`);
}
