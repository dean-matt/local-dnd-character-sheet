/**
 * Reads and writes for `roll_log`. Each answers `undefined` where the character does not
 * exist, the way `listCharacterPages` reads a miss.
 */
import type { rollRecordSchema } from "@dnd/character";
import { and, desc, eq, notInArray } from "drizzle-orm";
import type { z } from "zod";
import { characters, ROLL_LOG_LIMIT, rollLog } from "../characters.ts";
import type { CharactersDb } from "./characters.ts";

type RollRecord = z.infer<typeof rollRecordSchema>;

const exists = (db: Pick<CharactersDb, "select">, characterId: string) =>
  db.select({ id: characters.id }).from(characters).where(eq(characters.id, characterId)).get() !==
  undefined;

const entry = (row: typeof rollLog.$inferSelect) => {
  const { detail, result, rolledAt, characterId: _owner, ...rest } = row;
  return {
    ...rest,
    total: result,
    ...(detail as Pick<RollRecord, "dice" | "modifier" | "critical">),
    rolledAt: rolledAt.toISOString(),
  };
};

export function listRolls(db: CharactersDb, characterId: string) {
  if (!exists(db, characterId)) return undefined;
  return db
    .select()
    .from(rollLog)
    .where(eq(rollLog.characterId, characterId))
    .orderBy(desc(rollLog.id))
    .limit(ROLL_LOG_LIMIT)
    .all()
    .map(entry);
}

/** Stores `roll` as the character's newest and prunes the oldest past the bound. */
export function recordRoll(db: CharactersDb, characterId: string, roll: RollRecord, now: Date) {
  return db.transaction((tx) => {
    if (!exists(tx, characterId)) return undefined;
    const { dice, modifier, critical, total, label, notation } = roll;
    const row = tx
      .insert(rollLog)
      .values({
        characterId,
        label,
        notation,
        result: total,
        detail: { dice, modifier, critical },
        rolledAt: now,
      })
      .returning()
      .get();
    const kept = tx
      .select({ id: rollLog.id })
      .from(rollLog)
      .where(eq(rollLog.characterId, characterId))
      .orderBy(desc(rollLog.id))
      .limit(ROLL_LOG_LIMIT);
    tx.delete(rollLog)
      .where(and(eq(rollLog.characterId, characterId), notInArray(rollLog.id, kept)))
      .run();
    return entry(row);
  });
}
