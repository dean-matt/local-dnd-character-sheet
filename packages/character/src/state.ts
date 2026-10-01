import { HIT_DICE, RESET_TRIGGERS } from "@dnd/rules";
import { z } from "zod";
import { isUnique } from "./keys.ts";
import { contentRefSchema } from "./refs.ts";

const hitPointsSchema = z.strictObject({
  /**
   * Null reads as the derived maximum, so an unhurt character keeps pace with a level-up.
   * A writer restoring a character to full writes null, not the maximum it read.
   */
  current: z.int().nullable().default(null),
  temporary: z.int().min(0).default(0),
});

/** Grouped by die size, not by class: two d8 classes share one pool at rest. */
export const hitDicePoolSchema = z
  .strictObject({
    die: z.literal(HIT_DICE),
    total: z.int().min(0),
    remaining: z.int().min(0),
  })
  .refine((pool) => pool.remaining <= pool.total, { error: "remaining exceeds total" });

export const spellSlotSchema = z
  .strictObject({
    level: z.int().min(1).max(9),
    total: z.int().min(0),
    expended: z.int().min(0),
  })
  .refine((slot) => slot.expended <= slot.total, { error: "expended exceeds total" });

/** Class resources and user-invented counters share one shape, so neither needs special casing. */
export const resourceSchema = z
  .strictObject({
    name: z.string().min(1),
    current: z.int().min(0),
    maximum: z.int().min(0),
    resetsOn: z.enum(RESET_TRIGGERS),
  })
  .refine((resource) => resource.current <= resource.maximum, { error: "current exceeds maximum" });

const deathSavesSchema = z.strictObject({
  successes: z.int().min(0).max(3).default(0),
  failures: z.int().min(0).max(3).default(0),
});

/** The catalog's spelling in both rulesets. The list matches the name alone, so no source can smuggle in a second one. */
const EXHAUSTION = "Exhaustion";

export const characterStateSchema = z.strictObject({
  hitPoints: hitPointsSchema,
  hitDice: z
    .array(hitDicePoolSchema)
    .refine((pools) => isUnique(pools, (pool) => String(pool.die)), {
      error: "the same die size is listed twice",
    }),
  spellSlots: z
    .array(spellSlotSchema)
    .refine((slots) => isUnique(slots, (slot) => String(slot.level)), {
      error: "the same slot level is listed twice",
    }),
  /** Warlock slots recharge on a short rest, so they are counted apart from the rest. */
  pactSlots: spellSlotSchema.nullable().default(null),
  /**
   * Exhaustion is a catalog condition row in both rulesets, but only `exhaustion` carries
   * its level. Listing it here too gives a sheet two places to read and nothing to
   * reconcile them, so the list refuses the row and a reader renders it from the level.
   */
  conditions: z
    .array(contentRefSchema)
    .refine((conditions) => conditions.every((condition) => condition.name !== EXHAUSTION), {
      error: "exhaustion is held as a level, not a condition reference",
    }),
  resources: z.array(resourceSchema),
  deathSaves: deathSavesSchema,
  exhaustion: z.int().min(0).max(6).default(0),
});

/**
 * A stored character's state, as an endpoint returns it. Mirrors
 * `characterRecordSchema`: `characterId` and `updatedAt` are what the table adds beyond
 * the JSON column itself.
 */
export const characterStateRecordSchema = z.strictObject({
  characterId: z.string(),
  state: characterStateSchema,
  updatedAt: z.iso.datetime(),
});

export type CharacterStateRecord = z.infer<typeof characterStateRecordSchema>;

/**
 * The state a new character starts with: no damage taken, nothing spent, nothing
 * tracked yet. `hitPoints.current` is null rather than a number, because the maximum
 * needs the catalog's hit dice, which this package never reaches — a reader holding the
 * derived block resolves null to that maximum.
 */
export function defaultCharacterState(): CharacterState {
  return characterStateSchema.parse({
    hitPoints: {},
    hitDice: [],
    spellSlots: [],
    conditions: [],
    resources: [],
    deathSaves: {},
  });
}

export type CharacterState = z.infer<typeof characterStateSchema>;
