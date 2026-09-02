/**
 * Builds `data/content.db` from the vendored 5etools data.
 *
 * The database is created from scratch every run and is never migrated — if the
 * schema changes, you rebuild. Loading the tiers is the work of the content
 * milestone; today this creates the schema and stamps provenance so a stale or
 * partial build is diagnosable rather than silently wrong.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { CONTENT_SCHEMA } from "./schema.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const DB_PATH = join(ROOT, "data", "content.db");
const LOCKFILE = join(ROOT, "content.lock.json");

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

const tag = upstreamTag();

mkdirSync(dirname(DB_PATH), { recursive: true });
rmSync(DB_PATH, { force: true });
rmSync(`${DB_PATH}-wal`, { force: true });
rmSync(`${DB_PATH}-shm`, { force: true });

const db = new Database(DB_PATH);
db.exec(CONTENT_SCHEMA);

const stamp = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
for (const [key, value] of [
  ["upstream_tag", tag],
  ["built_at", new Date().toISOString()],
  ["built_by_commit", repoCommit()],
  ["node_version", process.version],
]) {
  stamp.run(key, value);
}
db.close();

console.log(`Built ${DB_PATH}`);
console.log(`  upstream ${tag}, node ${process.version}`);
