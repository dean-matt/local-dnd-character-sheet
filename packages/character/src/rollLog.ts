/**
 * A roll the client already made, as the roll log records it and lists it. The pool is
 * `rollDice`'s own, discarded dice included, so a stored roll can explain its total.
 */
import { z } from "zod";

const rolledDieSchema = z.strictObject({
  faces: z.int().positive(),
  value: z.int(),
  kept: z.boolean(),
  sign: z.union([z.literal(1), z.literal(-1)]),
});

export const rollRecordSchema = z.strictObject({
  label: z.string().min(1),
  notation: z.string().min(1),
  total: z.int(),
  dice: z.array(rolledDieSchema),
  modifier: z.int(),
  critical: z.boolean(),
  mode: z.enum(["normal", "advantage", "disadvantage"]).optional(),
  reason: z.enum(["elven-accuracy", "lucky", "portent"]).optional(),
});

export type RollRecord = z.infer<typeof rollRecordSchema>;

/** A `roll_log` row as an endpoint lists it, with the character that rolled it; each character keeps its newest 200. */
export const rollLogEntrySchema = rollRecordSchema.extend({
  id: z.int(),
  characterId: z.string(),
  characterName: z.string(),
  rolledAt: z.iso.datetime(),
});
