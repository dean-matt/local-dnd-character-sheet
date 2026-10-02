/**
 * The only path that writes `characters.definition`. `name`, `level`, `edition`,
 * `raceSummary` and `classSummary` are denormalized projections of it, so all five
 * recompute here in the same statement rather than arrive as arguments a caller could
 * set adrift. An edit and an undo share that statement, so a restore passes the schema
 * and the projections an edit does.
 */
import {
  type CharacterDefinition,
  type CharacterState,
  characterDefinitionSchema,
  classSummary,
  defaultCharacterState,
  raceSummary,
  totalLevel,
} from "@dnd/character";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as charactersSchema from "../characters.ts";
import { characterPages, characterState, characters } from "../characters.ts";
import { presetPageRows } from "./pages.ts";
import { deleteUndoEntry, newestUndoEntry, recordChange } from "./undo.ts";

export type CharactersDb = BetterSQLite3Database<typeof charactersSchema>;

export function listCharacters(db: CharactersDb) {
  return db.select().from(characters).all();
}

export function getCharacter(db: CharactersDb, id: string) {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

/**
 * Creates the character's `character_state` row and its preset pages alongside it, so
 * every read finds both. Import and creation are the same route, so both seed here.
 */
export function insertCharacter(
  db: CharactersDb,
  input: { id: string; definition: CharacterDefinition },
) {
  return db.transaction((tx) => {
    const row = tx
      .insert(characters)
      .values({
        id: input.id,
        name: input.definition.name,
        edition: input.definition.edition,
        level: totalLevel(input.definition),
        raceSummary: raceSummary(input.definition),
        classSummary: classSummary(input.definition),
        definition: input.definition,
      })
      .returning()
      .get();
    tx.insert(characterState)
      .values({ characterId: input.id, state: defaultCharacterState() })
      .run();
    tx.insert(characterPages).values(presetPageRows(input.id)).run();
    return row;
  });
}

type Db = Pick<CharactersDb, "select" | "insert" | "update" | "delete">;

function writeDefinition(db: Db, id: string, definition: CharacterDefinition, now: Date) {
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
 */
export function updateCharacterDefinition(
  db: CharactersDb,
  id: string,
  definition: CharacterDefinition,
) {
  return db.transaction((tx) => {
    const current = tx
      .select({ definition: characters.definition })
      .from(characters)
      .where(eq(characters.id, id))
      .get();
    if (!current) return undefined;
    const now = new Date();
    const before = characterDefinitionSchema.safeParse(current.definition);
    if (before.success) recordChange(tx, id, before.data, definition, now);
    return writeDefinition(tx, id, definition, now);
  });
}

export type UndoResult =
  | { kind: "restored"; row: NonNullable<ReturnType<typeof writeDefinition>> }
  | { kind: "empty" }
  | { kind: "invalid"; message: string };

/**
 * Restores the definition the newest `undo_log` row holds and drops that row, recording
 * nothing, since there is no redo. `undefined` where `id` names no character. A snapshot
 * the schema now refuses restores nothing and is dropped all the same, so the next undo
 * reaches the entry behind it; the current definition is never touched.
 */
export function undoLastChange(db: CharactersDb, id: string): UndoResult | undefined {
  return db.transaction((tx) => {
    const exists = tx
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.id, id))
      .get();
    if (!exists) return undefined;
    const newest = newestUndoEntry(tx, id);
    if (!newest) return { kind: "empty" };
    deleteUndoEntry(tx, newest.id);
    const previous = characterDefinitionSchema.safeParse(newest.previousState);
    if (!previous.success) {
      return {
        kind: "invalid",
        message: `Cannot restore "${newest.describedAs}", so it was dropped: ${previous.error.message}`,
      };
    }
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
