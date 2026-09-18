/**
 * The only path that writes `characters.definition`. `name`, `level` and `edition` are
 * denormalized projections of it, so all three recompute here in the same statement
 * rather than arrive as arguments a caller could set adrift.
 */
import { type CharacterDefinition, totalLevel } from "@dnd/character";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as charactersSchema from "../characters.ts";
import { characters } from "../characters.ts";

export type CharactersDb = BetterSQLite3Database<typeof charactersSchema>;

export function listCharacters(db: CharactersDb) {
  return db.select().from(characters).all();
}

export function getCharacter(db: CharactersDb, id: string) {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

export function insertCharacter(
  db: CharactersDb,
  input: { id: string; definition: CharacterDefinition },
): void {
  db.insert(characters)
    .values({
      id: input.id,
      name: input.definition.name,
      edition: input.definition.edition,
      level: totalLevel(input.definition),
      definition: input.definition,
    })
    .run();
}

export function updateCharacterDefinition(
  db: CharactersDb,
  id: string,
  definition: CharacterDefinition,
): void {
  db.update(characters)
    .set({
      definition,
      name: definition.name,
      edition: definition.edition,
      level: totalLevel(definition),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, id))
    .run();
}

/** Returns whether a row existed to delete. The `character_state` cascade needs `PRAGMA foreign_keys = ON`, set in `client.ts`. */
export function deleteCharacter(db: CharactersDb, id: string): boolean {
  return db.delete(characters).where(eq(characters.id, id)).run().changes > 0;
}
