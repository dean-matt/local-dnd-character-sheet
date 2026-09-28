/**
 * The user's real `characters.db` and `homebrew.db`, opened once at `data/` on import.
 *
 * Only `app.ts` imports this. Everything else opens its own pair, free of that side
 * effect: `openDatabases` from `client.ts` at a directory it controls, or in a test
 * `openTestDatabases` from `testDatabases.ts` in memory. Importing this module for the
 * real databases too would give every importer the same file handle and the same
 * real data, racing each other for the lock `client.test.ts`'s cascade test proves
 * `PRAGMA foreign_keys` turns on.
 *
 * `content.db` is not opened here: `openContentDb` opens one connection per query rather
 * than a process-lifetime handle, so a route reaches it by way of `DATA_DIR` rather than a
 * shared connection this module holds.
 */
import { resolve } from "node:path";
import { openDatabases } from "./client.ts";

export const DATA_DIR = resolve(import.meta.dirname, "../../../../data");

export const { charactersDb, homebrewDb } = openDatabases(DATA_DIR);
