/**
 * Opens `content.db` for one query.
 *
 * `pnpm content:build` publishes a new catalog under a content-addressed filename in
 * `<dataDir>/content/` and makes it live by rewriting the small `current` pointer file to
 * name it — never by renaming onto a database file itself, which Windows refuses when any
 * process holds it open. Opening fresh per query sidesteps staleness the same way a held
 * handle would: this reads `current` and opens whatever it names right now, so a query
 * already in flight keeps the version it opened and the next query picks up whatever
 * `current` names by then — at the cost of one open (and one tiny pointer read) per query,
 * cheap for local SQLite.
 *
 * That is only safe because `build-db.ts` never deletes a versioned database the same
 * build that stops it being current — a version survives one extra build after `current`
 * moves past it, so a query already reading the old file when a rebuild flips the pointer
 * keeps reading a file that is still there.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

export function openContentDb(dataDir: string): Database.Database {
  const contentDir = join(dataDir, "content");
  const current = readFileSync(join(contentDir, "current"), "utf8").trim();
  return new Database(join(contentDir, current), { readonly: true });
}
