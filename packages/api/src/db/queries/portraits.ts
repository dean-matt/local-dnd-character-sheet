/**
 * The image behind a character's avatar. It lives in `characters.db`, so the snapshot a
 * migration or a character delete takes carries it, and a character delete cascades to it.
 * Each write stamps `characters.portrait_updated_at` in the same transaction.
 */
import { eq } from "drizzle-orm";
import { characterPortraits, characters } from "../characters.ts";
import type { CharactersDb } from "./characters.ts";

export function getPortrait(db: CharactersDb, characterId: string) {
  return db
    .select({ mediaType: characterPortraits.mediaType, image: characterPortraits.image })
    .from(characterPortraits)
    .where(eq(characterPortraits.characterId, characterId))
    .get();
}

/** Replaces any portrait the character had. Returns whether the character exists. */
export function setPortrait(
  db: CharactersDb,
  characterId: string,
  portrait: { mediaType: string; image: Buffer },
): boolean {
  return db.transaction((tx) => {
    const stamped = tx
      .update(characters)
      .set({ portraitUpdatedAt: new Date() })
      .where(eq(characters.id, characterId))
      .run().changes;
    if (stamped === 0) return false;
    tx.insert(characterPortraits)
      .values({ characterId, ...portrait })
      .onConflictDoUpdate({ target: characterPortraits.characterId, set: portrait })
      .run();
    return true;
  });
}

/** Returns whether the character exists; removing a portrait it never had is no error. */
export function removePortrait(db: CharactersDb, characterId: string): boolean {
  return db.transaction((tx) => {
    const stamped = tx
      .update(characters)
      .set({ portraitUpdatedAt: null })
      .where(eq(characters.id, characterId))
      .run().changes;
    if (stamped === 0) return false;
    tx.delete(characterPortraits).where(eq(characterPortraits.characterId, characterId)).run();
    return true;
  });
}
