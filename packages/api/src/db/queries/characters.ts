/**
 * The only path that writes `characters.definition`. `level` and `edition` are
 * denormalized projections of it, so both recompute here in the same statement
 * rather than arrive as arguments a caller could set adrift.
 */
import { type CharacterDefinition, totalLevel } from "@dnd/character";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as charactersSchema from "../characters.ts";
import { characters } from "../characters.ts";

type CharactersDb = BetterSQLite3Database<typeof charactersSchema>;

export function insertCharacter(
  db: CharactersDb,
  input: { id: string; name: string; definition: CharacterDefinition },
): void {
  db.insert(characters)
    .values({
      id: input.id,
      name: input.name,
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
      edition: definition.edition,
      level: totalLevel(definition),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, id))
    .run();
}
