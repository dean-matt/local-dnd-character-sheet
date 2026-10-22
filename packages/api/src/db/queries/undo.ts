/**
 * Reads and writes for `undo_log`. A row holds the definition a write replaced, so undo
 * restores it whole. Only `characters.ts` records and pops a row, inside the same
 * transaction as the definition write.
 */
import {
  type CharacterDefinition,
  changePhrases,
  characterDefinitionSchema,
  describeChange,
  UNDO_LOG_LIMIT,
} from "@dnd/character";
import { and, desc, eq, gte, notInArray } from "drizzle-orm";
import { undoLog } from "../characters.ts";
import type { CharactersDb, CharactersWriter as Db } from "./characters.ts";

/**
 * A save landing within this long of the newest entry, on exactly the fields that entry
 * changed, merges into it, so a field's autosave burst is one undo. The window slides
 * with each merge: one field edited without a 30-second pause stays one entry however
 * long it runs. A section with no keys, such as spells or a resized inventory, is one
 * field, so two separate edits to it inside the window merge too. A write that sends
 * `Undo-Entry: own` is the way out for both.
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

/**
 * Newest first, each with every change undoing it reverses: from its snapshot to the next
 * newer one's, or to `current` for the newest. Where either side no longer passes the
 * schema, the entry's stored description stands in.
 */
export function listUndoEntries(db: CharactersDb, characterId: string, current: unknown) {
  const rows = db
    .select({
      id: undoLog.id,
      describedAs: undoLog.describedAs,
      changedAt: undoLog.changedAt,
      previousState: undoLog.previousState,
    })
    .from(undoLog)
    .where(eq(undoLog.characterId, characterId))
    .orderBy(desc(undoLog.id))
    .all();
  let after = characterDefinitionSchema.safeParse(current);
  return rows.map(({ previousState, ...entry }) => {
    const before = characterDefinitionSchema.safeParse(previousState);
    const phrases = before.success && after.success ? changePhrases(before.data, after.data) : [];
    after = before;
    return { ...entry, changes: phrases.length > 0 ? phrases : [entry.describedAs] };
  });
}

export function undoEntry(db: Db, characterId: string, id: number) {
  return db
    .select()
    .from(undoLog)
    .where(and(eq(undoLog.characterId, characterId), eq(undoLog.id, id)))
    .get();
}

export function deleteUndoEntry(db: Db, id: number) {
  db.delete(undoLog).where(eq(undoLog.id, id)).run();
}

/** Drops the entry `id` and every newer one, which an undo back to `id` reverses. */
export function deleteUndoEntriesFrom(db: Db, characterId: string, id: number) {
  db.delete(undoLog)
    .where(and(eq(undoLog.characterId, characterId), gte(undoLog.id, id)))
    .run();
}

/**
 * Records `before` as what undo restores after `after` lands, then prunes to the bound.
 * An `own` change neither merges into the newest entry nor takes a later write into its own.
 */
export function recordChange(
  db: Db,
  characterId: string,
  before: CharacterDefinition,
  after: CharacterDefinition,
  now: Date,
  own = false,
) {
  const change = describeChange(before, after);
  if (!change) return;

  const newest = own ? undefined : newestUndoEntry(db, characterId);
  const start = newest && characterDefinitionSchema.safeParse(newest.previousState);
  if (
    newest &&
    !newest.sealed &&
    start?.success &&
    now.getTime() - newest.changedAt.getTime() < COALESCE_WINDOW_MS
  ) {
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
    .values({
      characterId,
      previousState: before,
      describedAs: change.describedAs,
      changedAt: now,
      sealed: own,
    })
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
