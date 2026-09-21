/**
 * Opens `content.db` for one query.
 *
 * `pnpm content:build` publishes a new catalog by renaming a finished file over the old
 * one, so a handle held across that rename would otherwise keep the old file's inode —
 * serving a stale catalog until the process restarts, with no signal that it had gone
 * stale. Opening fresh per query sidesteps that: the query in flight keeps whatever file
 * it opened, and the next query picks up whatever is at the path now — at the cost of
 * one open per query, cheap for local SQLite.
 *
 * That is only safe because `build-db.ts` never publishes a catalog in WAL mode: a
 * published `content.db` is one self-contained file with no `-wal`/`-shm` sidecars, so a
 * query already reading the old file when a rebuild renames a new one into place is
 * unaffected either way — nothing it depends on gets deleted out from under it.
 */
import { join } from "node:path";
import Database from "better-sqlite3";

export function openContentDb(dataDir: string): Database.Database {
  return new Database(join(dataDir, "content.db"), { readonly: true });
}
