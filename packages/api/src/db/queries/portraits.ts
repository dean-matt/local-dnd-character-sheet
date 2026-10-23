/**
 * The image behind a character's avatar. It lives in `characters.db`, so the snapshot a
 * migration or a character delete takes carries it, and a character delete cascades to it.
 * Each write stamps `characters.portrait_updated_at` in the same transaction. One earlier
 * image is kept beside it, so an upload or a removal can be undone until the next one.
 */
import { eq } from "drizzle-orm";
import { characterPortraits, characterPortraitsPrevious, characters } from "../characters.ts";
import type { CharactersDb } from "./characters.ts";

export function getPortrait(db: CharactersDb, characterId: string) {
  return db
    .select({ mediaType: characterPortraits.mediaType, image: characterPortraits.image })
    .from(characterPortraits)
    .where(eq(characterPortraits.characterId, characterId))
    .get();
}

type Portrait = { mediaType: string; image: Buffer };

type Tx = Parameters<Parameters<CharactersDb["transaction"]>[0]>[0];

function shelveCurrent(tx: Tx, characterId: string) {
  const current = tx
    .select({ mediaType: characterPortraits.mediaType, image: characterPortraits.image })
    .from(characterPortraits)
    .where(eq(characterPortraits.characterId, characterId))
    .get();
  if (!current) return false;
  tx.insert(characterPortraitsPrevious)
    .values({ characterId, ...current })
    .onConflictDoUpdate({ target: characterPortraitsPrevious.characterId, set: current })
    .run();
  return true;
}

function stamp(
  tx: Tx,
  characterId: string,
  set: { portraitUpdatedAt: Date | null; hasPreviousPortrait?: boolean },
) {
  return tx.update(characters).set(set).where(eq(characters.id, characterId)).run().changes > 0;
}

/**
 * Replaces any portrait the character had, which becomes the one it can restore.
 * Returns whether the character exists.
 */
export function setPortrait(db: CharactersDb, characterId: string, portrait: Portrait): boolean {
  return db.transaction((tx) => {
    const shelved = shelveCurrent(tx, characterId);
    const stamped = stamp(tx, characterId, {
      portraitUpdatedAt: new Date(),
      ...(shelved && { hasPreviousPortrait: true }),
    });
    if (!stamped) return false;
    tx.insert(characterPortraits)
      .values({ characterId, ...portrait })
      .onConflictDoUpdate({ target: characterPortraits.characterId, set: portrait })
      .run();
    return true;
  });
}

/**
 * Returns whether the character exists; removing a portrait it never had is no error. The
 * image removed becomes the one it can restore.
 */
export function removePortrait(db: CharactersDb, characterId: string): boolean {
  return db.transaction((tx) => {
    const shelved = shelveCurrent(tx, characterId);
    const stamped = stamp(tx, characterId, {
      portraitUpdatedAt: null,
      ...(shelved && { hasPreviousPortrait: true }),
    });
    if (!stamped) return false;
    tx.delete(characterPortraits).where(eq(characterPortraits.characterId, characterId)).run();
    return true;
  });
}

/**
 * Makes the previous image current again, shelving the one it replaces so a second restore
 * swaps them back. Returns "missing" for no such character and "none" for nothing to restore.
 */
export function restorePortrait(
  db: CharactersDb,
  characterId: string,
): "restored" | "missing" | "none" {
  return db.transaction((tx) => {
    const previous = tx
      .select({
        mediaType: characterPortraitsPrevious.mediaType,
        image: characterPortraitsPrevious.image,
      })
      .from(characterPortraitsPrevious)
      .where(eq(characterPortraitsPrevious.characterId, characterId))
      .get();
    if (!previous) {
      const exists = tx
        .select({ id: characters.id })
        .from(characters)
        .where(eq(characters.id, characterId))
        .get();
      return exists ? "none" : "missing";
    }
    const shelved = shelveCurrent(tx, characterId);
    if (!shelved) {
      tx.delete(characterPortraitsPrevious)
        .where(eq(characterPortraitsPrevious.characterId, characterId))
        .run();
    }
    stamp(tx, characterId, { portraitUpdatedAt: new Date(), hasPreviousPortrait: shelved });
    tx.insert(characterPortraits)
      .values({ characterId, ...previous })
      .onConflictDoUpdate({ target: characterPortraits.characterId, set: previous })
      .run();
    return "restored";
  });
}
