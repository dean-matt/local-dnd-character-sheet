/**
 * Builds `data/content/` from the vendored 5etools data.
 *
 * The database is created from scratch every run and is never migrated — if the
 * schema changes, you rebuild. Every loader runs inside one transaction against
 * a staging file. A finished build is published under a content-addressed name
 * (`content-<hash>.db`) and made live by rewriting the small `current` pointer
 * file to name it — never by renaming onto the live database itself, which
 * Windows refuses when any process holds it open. `current` is read fresh and
 * fully on every open, never held open, so rewriting it is safe on both
 * platforms even while a reader has an old version open.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import Database from "better-sqlite3";
import { resolveCopies } from "./load/copy.ts";
import { drainUnmatchedFluff } from "./load/fluff.ts";
import { LOADERS, type Loader, type Row } from "./load/index.ts";
import { resolveVersions } from "./load/versions.ts";
import { CONTENT_SCHEMA } from "./schema.ts";
import { posix, verifyVendor } from "./sync.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const CONTENT_DIR = join(ROOT, "data", "content");
const CURRENT_FILE = "current";

export type BuildOptions = {
  vendorDir: string;
  contentDir: string;
  loaders: Loader[];
  meta: Record<string, string>;
};

/** Resolves the live database in `contentDir` by way of its `current` pointer. */
export function resolveContentDb(contentDir: string): string {
  return join(contentDir, readFileSync(join(contentDir, CURRENT_FILE), "utf8").trim());
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
  // Every matched file is parsed and held resident before the loader runs, so a
  // loader over `data/bestiary/*.json` holds the whole corpus while the
  // transaction is open. Copy resolution needs that anyway: a parent may be in
  // any of the declared files, so the set has to be complete before it starts.
  const parsed = new Map<string, unknown>();
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
      try {
        parsed.set(match, JSON.parse(readFileSync(join(vendorDir, match), "utf8")));
      } catch (cause) {
        throw new Error(`${match} could not be read`, { cause });
      }
    }
  }

  // `prepare` runs between the two mechanisms, so versions stay per file even
  // though copies no longer are.
  const sources = new Map<string, unknown>();
  for (const [path, copied] of resolveCopies(parsed)) {
    const prepared = loader.prepare ? loader.prepare(copied, path) : copied;
    sources.set(path, resolveVersions(prepared, path));
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

/**
 * Warns on a fluff entry no row's `json` claimed — see `drainUnmatchedFluff`.
 * The count includes the known-benign shapes `fluff.ts` documents, which is
 * why this warns rather than fails.
 */
function warnUnmatchedFluff(): void {
  const unmatched = drainUnmatchedFluff();
  if (unmatched.length === 0) return;
  const byFile = new Map<string, number>();
  for (const [path] of unmatched) byFile.set(path, (byFile.get(path) ?? 0) + 1);
  console.warn(`${unmatched.length} fluff entries matched no row:`);
  for (const [path, count] of [...byFile].sort()) console.warn(`  ${path}: ${count}`);
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function stagingName(pid: number): string {
  return `build.${pid}.incoming`;
}

/**
 * Removes staging files whose build is gone. A per-process name means no run
 * cleans up after another, so a killed build would otherwise leave a catalog's
 * worth of bytes in `data/content/` that no later run ever reaps.
 *
 * A pid outlives the build that held it and is eventually handed to something
 * else, so age is the backstop: no build runs for a day.
 */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function reapStaging(contentDir: string): void {
  for (const file of globSync("build.*.incoming*", { cwd: contentDir })) {
    const path = join(contentDir, file);
    const pid = Number(/^build\.(\d+)\.incoming(?:-wal|-shm)?$/.exec(file)?.[1]);
    if (!pid) continue;
    const mtimeMs = statSync(path, { throwIfNoEntry: false })?.mtimeMs;
    if (mtimeMs === undefined) continue;
    const stale = Date.now() - mtimeMs > STALE_AFTER_MS;
    if (pid !== process.pid && isRunning(pid) && !stale) continue;
    rmSync(path, { force: true });
  }
}

function contentHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

/** Points `current` at `name`, replacing whatever it named before. */
function publishCurrent(contentDir: string, name: string): void {
  const tmp = join(contentDir, `current.${process.pid}.tmp`);
  writeFileSync(tmp, name);
  renameSync(tmp, join(contentDir, CURRENT_FILE));
}

function readCurrentName(contentDir: string): string | undefined {
  try {
    return readFileSync(join(contentDir, CURRENT_FILE), "utf8").trim();
  } catch {
    return undefined;
  }
}

/**
 * Removes every versioned database but the one just published and the one that
 * was current right before it. A version therefore survives one full build
 * after it stops being current, which gives any per-query reader that resolved
 * `current` to it — before this build's flip — the whole next build's duration
 * to finish before its file can disappear out from under it.
 */
function reapVersions(contentDir: string, keep: ReadonlySet<string>): void {
  for (const file of globSync("content-*.db", { cwd: contentDir })) {
    if (!keep.has(file)) rmSync(join(contentDir, file), { force: true });
  }
}

/** Returns the row count per table written. */
export function buildContent({
  vendorDir,
  contentDir,
  loaders,
  meta,
}: BuildOptions): Record<string, number> {
  mkdirSync(contentDir, { recursive: true });
  reapStaging(contentDir);

  // Per-process, so two builds cannot unlink each other's staging file and
  // publish the survivor's half-written database.
  const staging = join(contentDir, stagingName(process.pid));
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
    // A published version is never left in WAL mode, so it never carries `-wal`/`-shm`
    // sidecars for another build's cleanup to disturb. Switching back to a rollback
    // journal here checkpoints every committed row into the main file first.
    db.pragma("journal_mode = DELETE");
    db.close();
    if (existsSync(`${staging}-wal`)) {
      throw new Error(`${staging}-wal survived the close; refusing to publish a partial catalog`);
    }

    const name = `content-${contentHash(staging)}.db`;
    const target = join(contentDir, name);
    const previous = readCurrentName(contentDir);
    // Identical content hashes to the same name — nothing to publish, and renaming
    // onto it would risk the very rename-over-open-handle problem this scheme
    // exists to avoid.
    if (existsSync(target)) {
      discard(staging);
    } else {
      renameSync(staging, target);
    }
    publishCurrent(contentDir, name);
    reapVersions(contentDir, new Set(previous ? [name, previous] : [name]));
    warnUnmatchedFluff();
  } catch (error) {
    // A pool a failed loader registered would otherwise sit in fluff.ts's
    // module scope and get swept into whatever call runs next, misattributing
    // an aborted build's unmatched fluff to one that never touched it.
    drainUnmatchedFluff();
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
    contentDir: CONTENT_DIR,
    loaders: LOADERS,
    meta: {
      upstream_tag: tag,
      built_at: new Date().toISOString(),
      built_by_commit: repoCommit(),
      node_version: process.version,
    },
  });

  console.log(`Built ${CONTENT_DIR}`);
  console.log(`  upstream ${tag}, node ${process.version}`);
  if (LOADERS.length === 0) console.log("  no loaders registered — schema and meta only");
  for (const table of Object.keys(counts).sort()) console.log(`  ${table} ${counts[table]}`);
}
