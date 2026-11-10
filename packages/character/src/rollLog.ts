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

/** What a roll was for. `dice` is a roll the rules text asks for without saying what it is. */
const rollTypeSchema = z.enum([
  "attack",
  "damage",
  "check",
  "save",
  "spell-attack",
  "hit-die",
  "dice",
]);

export type RollType = z.infer<typeof rollTypeSchema>;

export const rollRecordSchema = z.strictObject({
  type: rollTypeSchema,
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

/**
 * A `roll_log` row as an endpoint lists it, with the character that rolled it; each character
 * keeps its newest 200. A roll stored before rolls carried a type has none.
 */
export const rollLogEntrySchema = rollRecordSchema.extend({
  type: rollTypeSchema.optional(),
  id: z.int(),
  characterId: z.string(),
  characterName: z.string(),
  rolledAt: z.iso.datetime(),
});
