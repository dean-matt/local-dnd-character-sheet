/**
 * The only path that writes `characters.definition`. `name`, `level` and `edition` are
 * denormalized projections of it, so all three recompute here in the same statement
 * rather than arrive as arguments a caller could set adrift. An edit and an undo share
 * that statement, so a restore passes the schema and the projections an edit does.
 */
import { HOMEBREW_SOURCE } from "@dnd/catalog";
import {
  type CharacterDefinition,
  type CharacterFile,
  type CharacterState,
  characterDefinitionSchema,
  characterStateSchema,
  defaultCharacterState,
  PRESET_PAGES,
  refKey,
  totalLevel,
} from "@dnd/character";
import type { Edition } from "@dnd/rules";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as charactersSchema from "../characters.ts";
import { characterPages, characterState, characters } from "../characters.ts";
import { writePages } from "./pages.ts";
import {
  deleteUndoEntriesFrom,
  deleteUndoEntry,
  newestUndoEntry,
  oldestUndoEntryFrom,
  recordBothChange,
  recordChange,
  recordStateChange,
  snapshotOf,
  undoEntry,
} from "./undo.ts";

export type CharactersDb = BetterSQLite3Database<typeof charactersSchema>;

/** Oldest first; `id` breaks a tie within the second `createdAt` resolves to. */
export function listCharacters(db: CharactersDb) {
  return db.select().from(characters).orderBy(characters.createdAt, characters.id).all();
}

export function getCharacter(db: CharactersDb, id: string) {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

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

/** Writes `file` as a new character under `id` inside a transaction the caller opened. */
export function importCharacterRows(
  tx: Parameters<Parameters<CharactersDb["transaction"]>[0]>[0],
  id: string,
  file: CharacterFile,
) {
  const row = insertCharacterRows(tx, id, file.definition, file.state);
  writePages(tx, id, file.pages);
  return row;
}

/** Writes `file` as a new character under `id`, never over an existing one. */
export function importCharacter(db: CharactersDb, id: string, file: CharacterFile) {
  return db.transaction((tx) => importCharacterRows(tx, id, file));
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
 * What an undo back to entry `from` restores: the definition the oldest definition entry
 * from it on holds, and the state the oldest state entry holds, either absent where no entry
 * of its kind is among them. `refused` is the first of those two the schema now refuses.
 */
function snapshotsFrom(tx: CharactersWriter, id: string, from: number) {
  const definitionEntry = oldestUndoEntryFrom(tx, id, from, "definition");
  const stateEntry = oldestUndoEntryFrom(tx, id, from, "state");
  const definition =
    definitionEntry &&
    characterDefinitionSchema.safeParse(snapshotOf(definitionEntry, "definition"));
  const state = stateEntry && characterStateSchema.safeParse(snapshotOf(stateEntry, "state"));
  if (definition?.success === false) return { refused: definitionEntry } as const;
  if (state?.success === false) return { refused: stateEntry } as const;
  return { definition: definition?.data, state: state?.data } as const;
}

/**
 * Restores what the target `undo_log` row and every newer one replaced, in one write to the
 * definition, the state, or both, and drops those rows, recording nothing, since there is no
 * redo. `undefined` where `id` names no character. A snapshot the schema now refuses
 * restores nothing and drops that row alone, so the next undo reaches past it; the current
 * definition, state and the other entries are never touched.
 */
export function undoChanges(
  db: CharactersDb,
  id: string,
  target: UndoTarget = {},
): UndoResult | undefined {
  return db.transaction((tx) => {
    const found = findUndoTarget(tx, id, target);
    if (found?.kind !== "found") return found;
    const snapshots = snapshotsFrom(tx, id, found.entry.id);
    if (snapshots.refused) {
      deleteUndoEntry(tx, snapshots.refused.id);
      return {
        kind: "invalid",
        message: `Cannot restore "${snapshots.refused.describedAs}", so it was dropped`,
      };
    }
    deleteUndoEntriesFrom(tx, id, found.entry.id);
    const now = new Date();
    if (snapshots.state) writeState(tx, id, snapshots.state, now);
    const row = snapshots.definition
      ? writeDefinition(tx, id, snapshots.definition, now)
      : tx.select().from(characters).where(eq(characters.id, id)).get();
    if (!row) return undefined;
    return { kind: "restored", row };
  });
}

/** Returns whether a row existed to delete. The `character_state` cascade needs `PRAGMA foreign_keys = ON`, set in `client.ts`. */
export function deleteCharacter(db: CharactersDb, id: string): boolean {
  return db.delete(characters).where(eq(characters.id, id)).run().changes > 0;
}

/**
 * Whether a parsed `definition` or state holds `{homebrewId}` anywhere `entryRefSchema`
 * allows one — background, inventory, spells, feats, optional features, what granted them
 * and the spell concentrated on.
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
 * The characters whose definition or play state references a homebrew row, so a caller can
 * refuse a delete and name them. A full table scan is fine at single-user scale; an index
 * table is the way out once a save touches enough rows to notice.
 */
export function charactersReferencingHomebrew(
  db: CharactersDb,
  homebrewId: string,
): { id: string; name: string }[] {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      definition: characters.definition,
      state: characterState.state,
    })
    .from(characters)
    .leftJoin(characterState, eq(characterState.characterId, characters.id))
    .orderBy(characters.createdAt, characters.id)
    .all()
    .filter((row) => referencesHomebrewId([row.definition, row.state], homebrewId))
    .map((row) => ({ id: row.id, name: row.name }));
}

/**
 * The characters of the skill's edition holding it in their skill proficiencies, which
 * cite it by `(name, source)` and not by id, so a rename, a move to another edition or a
 * delete must find them by name.
 */
export function charactersReferencingHomebrewSkill(
  db: CharactersDb,
  { name, edition }: { name: string; edition: Edition },
): { id: string; name: string }[] {
  const wanted = name.toLowerCase();
  return listCharacters(db)
    .filter(({ definition }) => {
      const held = characterDefinitionSchema.safeParse(definition).data;
      return (
        held?.edition === edition &&
        held.proficiencies.skills.some(
          ({ ref }) => ref.source === HOMEBREW_SOURCE && ref.name.toLowerCase() === wanted,
        )
      );
    })
    .map((row) => ({ id: row.id, name: row.name }));
}

/**
 * The characters holding a homebrew deity, which they cite by `(name, source, pantheon)` and
 * not by id, so a rename, a move to another pantheon or a delete must find them by that key.
 */
export function charactersReferencingHomebrewDeity(
  db: CharactersDb,
  { name, pantheon }: { name: string; pantheon: string },
): { id: string; name: string }[] {
  const [wantedName, wantedPantheon] = [name.toLowerCase(), pantheon.toLowerCase()];
  return listCharacters(db)
    .filter(({ definition }) => {
      const deity = characterDefinitionSchema.safeParse(definition).data?.deity;
      return (
        deity?.source === HOMEBREW_SOURCE &&
        deity.name.toLowerCase() === wantedName &&
        deity.pantheon.toLowerCase() === wantedPantheon
      );
    })
    .map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Resets what each character holding a homebrew skill typed over it, for the skill switching
 * between an ability and a flat bonus: the flat number (0 for a new flat skill, none for an
 * ability one) and any override of its modifier. Each reset is that character's own undo
 * entry.
 */
export function resetHomebrewSkillValues(
  db: CharactersDb,
  skill: { name: string; edition: Edition },
  toFlat: boolean,
) {
  const wanted = skill.name.toLowerCase();
  const held = (ref: { name: string; source: string }) =>
    ref.source === HOMEBREW_SOURCE && ref.name.toLowerCase() === wanted;
  for (const { id } of charactersReferencingHomebrewSkill(db, skill)) {
    const row = getCharacter(db, id);
    const definition = characterDefinitionSchema.safeParse(row?.definition).data;
    if (!definition) continue;
    const prefixes = definition.proficiencies.skills
      .filter(({ ref }) => held(ref))
      .map(({ ref }) => `skills.${refKey(ref)}.`);
    updateCharacterDefinition(db, id, {
      ...definition,
      proficiencies: {
        ...definition.proficiencies,
        skills: definition.proficiencies.skills.map((entry) => {
          if (!held(entry.ref)) return entry;
          const { flat: _flat, ...rest } = entry;
          return toFlat ? { ...rest, flat: 0 } : rest;
        }),
      },
      overrides: Object.fromEntries(
        Object.entries(definition.overrides).filter(
          ([key]) => !prefixes.some((prefix) => key.startsWith(prefix)),
        ),
      ),
    });
  }
}

export function getCharacterState(db: CharactersDb, characterId: string) {
  return db.select().from(characterState).where(eq(characterState.characterId, characterId)).get();
}

function writeState(db: CharactersWriter, characterId: string, state: CharacterState, now: Date) {
  return db
    .update(characterState)
    .set({ state, updatedAt: now })
    .where(eq(characterState.characterId, characterId))
    .returning()
    .get();
}

/**
 * Replaces the definition and the state in one transaction and records one undo entry holding
 * both, so a failure of either writes neither. Results as `updateCharacterDefinition`.
 */
export function updateCharacterAndState(
  db: CharactersDb,
  id: string,
  definition: CharacterDefinition,
  state: CharacterState,
  unmodifiedSince?: Date,
) {
  return db.transaction((tx) => {
    const current = tx
      .select({ definition: characters.definition, updatedAt: characters.updatedAt })
      .from(characters)
      .where(eq(characters.id, id))
      .get();
    const currentState = tx
      .select({ state: characterState.state })
      .from(characterState)
      .where(eq(characterState.characterId, id))
      .get();
    if (!current || !currentState) return undefined;
    if (unmodifiedSince && current.updatedAt.getTime() > unmodifiedSince.getTime())
      return "stale" as const;
    const now = new Date();
    const beforeDefinition = characterDefinitionSchema.safeParse(current.definition);
    const beforeState = characterStateSchema.safeParse(currentState.state);
    if (beforeDefinition.success && beforeState.success) {
      recordBothChange(
        tx,
        id,
        { definition: beforeDefinition.data, state: beforeState.data },
        { definition, state },
        now,
      );
    }
    const row = writeDefinition(tx, id, definition, now);
    const stateRow = writeState(tx, id, state, now);
    return { row, stateRow };
  });
}

/**
 * `undefined` where `characterId` names no row, the way `updateCharacterDefinition` reads
 * a miss. Touches only `character_state` and `undo_log` — `characters.definition`,
 * `.level` and `.edition` are a different table this statement never names. Records what
 * it replaced as its own undo entry; a stored state its schema now refuses records
 * nothing, since undo could not restore it.
 */
export function updateCharacterState(db: CharactersDb, characterId: string, state: CharacterState) {
  return db.transaction((tx) => {
    const current = tx
      .select({ state: characterState.state })
      .from(characterState)
      .where(eq(characterState.characterId, characterId))
      .get();
    if (!current) return undefined;
    const now = new Date();
    const before = characterStateSchema.safeParse(current.state);
    if (before.success) recordStateChange(tx, characterId, before.data, state, now);
    return writeState(tx, characterId, state, now);
  });
}
