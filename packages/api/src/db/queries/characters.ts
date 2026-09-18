/**
 * The only path that writes `characters.definition`. `name`, `level` and `edition` are
 * denormalized projections of it, so all three recompute here in the same statement
 * rather than arrive as arguments a caller could set adrift.
 */
import {
  type CharacterDefinition,
  type CharacterState,
  defaultCharacterState,
  totalLevel,
} from "@dnd/character";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as charactersSchema from "../characters.ts";
import { characterState, characters } from "../characters.ts";

export type CharactersDb = BetterSQLite3Database<typeof charactersSchema>;

export function listCharacters(db: CharactersDb) {
  return db.select().from(characters).all();
}

export function getCharacter(db: CharactersDb, id: string) {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

/** Creates the character's `character_state` row alongside it, so every read finds one. */
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
        definition: input.definition,
      })
      .returning()
      .get();
    tx.insert(characterState)
      .values({ characterId: input.id, state: defaultCharacterState() })
      .run();
    return row;
  });
}

/** `undefined` where `id` names no row, so a caller reads a missed update the way `getCharacter` reads a miss. */
export function updateCharacterDefinition(
  db: CharactersDb,
  id: string,
  definition: CharacterDefinition,
) {
  return db
    .update(characters)
    .set({
      definition,
      name: definition.name,
      edition: definition.edition,
      level: totalLevel(definition),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, id))
    .returning()
    .get();
}

/** Returns whether a row existed to delete. The `character_state` cascade needs `PRAGMA foreign_keys = ON`, set in `client.ts`. */
export function deleteCharacter(db: CharactersDb, id: string): boolean {
  return db.delete(characters).where(eq(characters.id, id)).run().changes > 0;
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
