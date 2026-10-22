/**
 * The only path that writes `characters.definition`. `name`, `level`, `edition`,
 * `raceSummary` and `classSummary` are denormalized projections of it, so all five
 * recompute here in the same statement rather than arrive as arguments a caller could
 * set adrift. An edit and an undo share that statement, so a restore passes the schema
 * and the projections an edit does.
 */
import {
  type CharacterDefinition,
  type CharacterFile,
  type CharacterState,
  characterDefinitionSchema,
  classSummary,
  defaultCharacterState,
  PRESET_PAGES,
  raceSummary,
  totalLevel,
} from "@dnd/character";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as charactersSchema from "../characters.ts";
import { characterPages, characterState, characters } from "../characters.ts";
import { writePages } from "./pages.ts";
import {
  deleteUndoEntriesFrom,
  deleteUndoEntry,
  newestUndoEntry,
  recordChange,
  undoEntry,
} from "./undo.ts";

export type CharactersDb = BetterSQLite3Database<typeof charactersSchema>;

export function listCharacters(db: CharactersDb) {
  return db.select().from(characters).all();
}

export function getCharacter(db: CharactersDb, id: string) {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

/** The `characters` row and the `character_state` row every character starts with. */
function insertCharacterRows(
  tx: Pick<CharactersDb, "insert">,
  id: string,
  definition: CharacterDefinition,
  state: CharacterState = defaultCharacterState(),
) {
  const row = tx
    .insert(characters)
    .values({
      id,
      name: definition.name,
      edition: definition.edition,
      level: totalLevel(definition),
      raceSummary: raceSummary(definition),
      classSummary: classSummary(definition),
      definition,
    })
    .returning()
    .get();
  tx.insert(characterState).values({ characterId: id, state }).run();
  return row;
}

/**
 * Creates the character's `character_state` row and its preset pages alongside it, so
 * every read finds both.
 */
export function insertCharacter(
  db: CharactersDb,
  input: { id: string; definition: CharacterDefinition },
) {
  return db.transaction((tx) => {
    const row = insertCharacterRows(tx, input.id, input.definition);
    writePages(tx, input.id, PRESET_PAGES);
    return row;
  });
}

/**
 * Copies `sourceId`'s definition and pages under `id`, naming the copy "<name> (copy)".
 * State starts at the default, and the roll and undo logs start empty, since a copy has
 * played nothing yet. `undefined` where `sourceId` names no character.
 */
export function duplicateCharacter(db: CharactersDb, sourceId: string, id: string) {
  return db.transaction((tx) => {
    const source = tx.select().from(characters).where(eq(characters.id, sourceId)).get();
    if (!source) return undefined;
    const parsed = characterDefinitionSchema.parse(source.definition);
    const row = insertCharacterRows(tx, id, { ...parsed, name: `${parsed.name} (copy)` });
    const pages = tx
      .select()
      .from(characterPages)
      .where(eq(characterPages.characterId, sourceId))
      .all();
    if (pages.length > 0) {
      tx.insert(characterPages)
        .values(pages.map((page) => ({ ...page, characterId: id })))
        .run();
    }
    return row;
  });
}

/** Writes `file` as a new character under `id`, never over an existing one. */
export function importCharacter(db: CharactersDb, id: string, file: CharacterFile) {
  return db.transaction((tx) => {
    const row = insertCharacterRows(tx, id, file.definition, file.state);
    writePages(tx, id, file.pages);
    return row;
  });
}

/** What a transaction and the database both offer, so a helper serves either. */
export type CharactersWriter = Pick<CharactersDb, "select" | "insert" | "update" | "delete">;

function writeDefinition(
  db: CharactersWriter,
  id: string,
  definition: CharacterDefinition,
  now: Date,
) {
  return db
    .update(characters)
    .set({
      definition,
      name: definition.name,
      edition: definition.edition,
      level: totalLevel(definition),
      raceSummary: raceSummary(definition),
      classSummary: classSummary(definition),
      updatedAt: now,
    })
    .where(eq(characters.id, id))
    .returning()
    .get();
}

/**
 * `undefined` where `id` names no row, so a caller reads a missed update the way
 * `getCharacter` reads a miss. Records what it replaced in `undo_log`; a stored
 * definition its schema now refuses records nothing, since undo could not restore it.
 *
 * `"stale"`, writing nothing, where `unmodifiedSince` is given and the row was written
 * after it. `updated_at` holds whole seconds, so a write landing in the same second as
 * the one the caller read passes; a millisecond column or a revision counter closes that.
 */
export function updateCharacterDefinition(
  db: CharactersDb,
  id: string,
  definition: CharacterDefinition,
  unmodifiedSince?: Date,
  ownUndoEntry = false,
) {
  return db.transaction((tx) => {
    const current = tx
      .select({ definition: characters.definition, updatedAt: characters.updatedAt })
      .from(characters)
      .where(eq(characters.id, id))
      .get();
    if (!current) return undefined;
    if (unmodifiedSince && current.updatedAt.getTime() > unmodifiedSince.getTime())
      return "stale" as const;
    const now = new Date();
    const before = characterDefinitionSchema.safeParse(current.definition);
    if (before.success) recordChange(tx, id, before.data, definition, now, ownUndoEntry);
    return writeDefinition(tx, id, definition, now);
  });
}

export type UndoResult =
  | { kind: "restored"; row: NonNullable<ReturnType<typeof writeDefinition>> }
  | { kind: "empty" }
  | { kind: "missing" }
  | { kind: "stale" }
  | { kind: "invalid"; message: string };

/**
 * Where to undo back to. `to` names the oldest entry to undo, the newest where absent.
 * `newest` and `unmodifiedSince` are what the caller last read: the log's head and the
 * character's `updatedAt`. Either one differing refuses as `"stale"`. `updated_at` holds
 * whole seconds, so `newest` is what catches an entry added or undone in the same second;
 * a burst merging into the head within that second still passes.
 */
export interface UndoTarget {
  to?: number;
  newest?: number;
  unmodifiedSince?: Date;
}

/** The entry `target` names, or why there is none to undo; `undefined` where `id` names no character. */
function findUndoTarget(
  tx: CharactersWriter,
  id: string,
  { to, newest: readNewest, unmodifiedSince }: UndoTarget,
) {
  const current = tx
    .select({ updatedAt: characters.updatedAt })
    .from(characters)
    .where(eq(characters.id, id))
    .get();
  if (!current) return undefined;
  if (unmodifiedSince && current.updatedAt.getTime() > unmodifiedSince.getTime()) {
    return { kind: "stale" } as const;
  }
  const newest = newestUndoEntry(tx, id);
  if (readNewest !== undefined && newest?.id !== readNewest) return { kind: "stale" } as const;
  if (!newest) return { kind: "empty" } as const;
  const entry = to === undefined ? newest : undoEntry(tx, id, to);
  return entry ? ({ kind: "found", entry } as const) : ({ kind: "missing" } as const);
}

/**
 * Restores the definition the target `undo_log` row holds, in one write, and drops that
 * row and every newer one, recording nothing, since there is no redo. `undefined` where
 * `id` names no character. A snapshot the schema now refuses restores nothing and drops
 * that row alone, so the next undo reaches the entry behind it; the current definition
 * and the newer entries are never touched.
 */
export function undoChanges(
  db: CharactersDb,
  id: string,
  target: UndoTarget = {},
): UndoResult | undefined {
  return db.transaction((tx) => {
    const found = findUndoTarget(tx, id, target);
    if (found?.kind !== "found") return found;
    const { entry } = found;
    const previous = characterDefinitionSchema.safeParse(entry.previousState);
    if (!previous.success) {
      deleteUndoEntry(tx, entry.id);
      return {
        kind: "invalid",
        message: `Cannot restore "${entry.describedAs}", so it was dropped`,
      };
    }
    deleteUndoEntriesFrom(tx, id, entry.id);
    const row = writeDefinition(tx, id, previous.data, new Date());
    if (!row) return undefined;
    return { kind: "restored", row };
  });
}

/** Returns whether a row existed to delete. The `character_state` cascade needs `PRAGMA foreign_keys = ON`, set in `client.ts`. */
export function deleteCharacter(db: CharactersDb, id: string): boolean {
  return db.delete(characters).where(eq(characters.id, id)).run().changes > 0;
}

/**
 * Whether a parsed `definition` holds `{homebrewId}` anywhere `entryRefSchema` allows
 * one — background, inventory, spells, feats, optional features and what granted them.
 * Walks the JSON rather than naming each field, so a reference added anywhere in that
 * shape is still found without a matching edit here.
 */
function referencesHomebrewId(value: unknown, homebrewId: string): boolean {
  if (Array.isArray(value)) return value.some((item) => referencesHomebrewId(item, homebrewId));
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if ("homebrewId" in record) return record.homebrewId === homebrewId;
  return Object.values(record).some((item) => referencesHomebrewId(item, homebrewId));
}

/**
 * The characters whose definition references a homebrew row, so a caller can refuse a
 * delete and name them. A full table scan is fine at single-user scale; an index table
 * is the way out once a save touches enough rows to notice.
 */
export function charactersReferencingHomebrew(
  db: CharactersDb,
  homebrewId: string,
): { id: string; name: string }[] {
  return listCharacters(db)
    .filter((row) => referencesHomebrewId(row.definition, homebrewId))
    .map((row) => ({ id: row.id, name: row.name }));
}

export function getCharacterState(db: CharactersDb, characterId: string) {
  return db.select().from(characterState).where(eq(characterState.characterId, characterId)).get();
}

/**
 * `undefined` where `characterId` names no row, the way `updateCharacterDefinition` reads
 * a miss. Touches only `character_state` — `characters.definition`, `.level` and
 * `.edition` are a different table this statement never names.
 */
export function updateCharacterState(db: CharactersDb, characterId: string, state: CharacterState) {
  return db
    .update(characterState)
    .set({ state, updatedAt: new Date() })
    .where(eq(characterState.characterId, characterId))
    .returning()
    .get();
}
