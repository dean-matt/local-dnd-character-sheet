/**
 * Reads and writes for `undo_log`. A row holds the definition a write replaced, so undo
 * restores it whole. Only `characters.ts` records and pops a row, inside the same
 * transaction as the definition write.
 */
import {
  type CharacterDefinition,
  characterDefinitionSchema,
  describeChange,
} from "@dnd/character";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { UNDO_LOG_LIMIT, undoLog } from "../characters.ts";
import type { CharactersDb } from "./characters.ts";

/** What a transaction and the database both offer, so a helper serves either. */
type Db = Pick<CharactersDb, "select" | "insert" | "update" | "delete">;

/**
 * A save landing within this long of the newest entry, on exactly the fields that entry
 * changed, merges into it, so a field's autosave burst is one undo. The window slides
 * with each merge: one field edited without a 30-second pause stays one entry however
 * long it runs. A per-edit id sent by the client is the way out once two edits merge.
 */
const COALESCE_WINDOW_MS = 30_000;

const sameFields = (a: string[], b: string[]) =>
  a.length === b.length && a.every((path) => b.includes(path));

export function newestUndoEntry(db: Db, characterId: string) {
  return db
    .select()
    .from(undoLog)
    .where(eq(undoLog.characterId, characterId))
    .orderBy(desc(undoLog.id))
    .limit(1)
    .get();
}

export function listUndoEntries(db: CharactersDb, characterId: string) {
  return db
    .select({ id: undoLog.id, describedAs: undoLog.describedAs, changedAt: undoLog.changedAt })
    .from(undoLog)
    .where(eq(undoLog.characterId, characterId))
    .orderBy(desc(undoLog.id))
    .all();
}

export function deleteUndoEntry(db: Db, id: number) {
  db.delete(undoLog).where(eq(undoLog.id, id)).run();
}

/** Records `before` as what undo restores after `after` lands, then prunes to the bound. */
export function recordChange(
  db: Db,
  characterId: string,
  before: CharacterDefinition,
  after: CharacterDefinition,
  now: Date,
) {
  const change = describeChange(before, after);
  if (!change) return;

  const newest = newestUndoEntry(db, characterId);
  const start = newest && characterDefinitionSchema.safeParse(newest.previousState);
  if (newest && start?.success && now.getTime() - newest.changedAt.getTime() < COALESCE_WINDOW_MS) {
    const sofar = describeChange(start.data, before);
    if (sofar && sameFields(sofar.paths, change.paths)) {
      const merged = describeChange(start.data, after);
      if (merged) {
        db.update(undoLog)
          .set({ describedAs: merged.describedAs, changedAt: now })
          .where(eq(undoLog.id, newest.id))
          .run();
      } else {
        deleteUndoEntry(db, newest.id);
      }
      return;
    }
  }

  db.insert(undoLog)
    .values({ characterId, previousState: before, describedAs: change.describedAs, changedAt: now })
    .run();
  const kept = db
    .select({ id: undoLog.id })
    .from(undoLog)
    .where(eq(undoLog.characterId, characterId))
    .orderBy(desc(undoLog.id))
    .limit(UNDO_LOG_LIMIT);
  db.delete(undoLog)
    .where(and(eq(undoLog.characterId, characterId), notInArray(undoLog.id, kept)))
    .run();
}
