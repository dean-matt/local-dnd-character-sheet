/**
 * The user's real `characters.db` and `homebrew.db`, opened once at `data/` on import.
 *
 * Only `app.ts` imports this. Everything else — every test included — imports
 * `openDatabases` from `client.ts` instead, which carries no such side effect, and
 * opens its own pair at a temp directory it controls. Importing this module for the
 * real databases too would give every importer the same file handle and the same
 * real data, racing each other for the lock `client.test.ts`'s cascade test proves
 * `PRAGMA foreign_keys` turns on.
 */
import { resolve } from "node:path";
import { openDatabases } from "./client.ts";

const DATA_DIR = resolve(import.meta.dirname, "../../../../data");

export const { charactersDb, homebrewDb } = openDatabases(DATA_DIR);
