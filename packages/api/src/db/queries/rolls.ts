/** Reads and writes for `roll_log`. `recordRoll` answers `undefined` where the character does not exist. */
import type { RollRecord } from "@dnd/character";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { characters, ROLL_LOG_LIMIT, rollLog } from "../characters.ts";
import type { CharactersDb } from "./characters.ts";

const entry = (row: typeof rollLog.$inferSelect, characterName: string) => {
  const { detail, result, rolledAt, ...rest } = row;
  return {
    ...rest,
    characterName,
    total: result,
    ...(detail as Pick<RollRecord, "dice" | "modifier" | "critical" | "mode" | "reason">),
    rolledAt: rolledAt.toISOString(),
  };
};

/** Every character's rolls, newest first. Unlimited: 200 a character, so it grows with the character count; page it if that gets large. */
export function listRolls(db: CharactersDb) {
  return db
    .select({ roll: rollLog, characterName: characters.name })
    .from(rollLog)
    .innerJoin(characters, eq(characters.id, rollLog.characterId))
    .orderBy(desc(rollLog.id))
    .all()
    .map(({ roll, characterName }) => entry(roll, characterName));
}

/** Stores `roll` as the character's newest and prunes the oldest past the bound. */
export function recordRoll(db: CharactersDb, characterId: string, roll: RollRecord, now: Date) {
  return db.transaction((tx) => {
    const owner = tx
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.id, characterId))
      .get();
    if (!owner) return undefined;
    const { dice, modifier, critical, mode, reason, total, label, notation } = roll;
    const row = tx
      .insert(rollLog)
      .values({
        characterId,
        label,
        notation,
        result: total,
        detail: { dice, modifier, critical, mode, reason },
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
    return entry(row, owner.name);
  });
}
