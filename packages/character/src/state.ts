import { HIT_DICE, RESET_TRIGGERS } from "@dnd/rules";
import { z } from "zod";
import { classResourceKey, isUnique } from "./keys.ts";
import { contentRefSchema, entryRefSchema } from "./refs.ts";

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

/** A counter the user added, such as Superiority Dice, which no class table prints. */
export const resourceSchema = z
  .strictObject({
    name: z.string().min(1),
    current: z.int().min(0),
    maximum: z.int().min(0),
    resetsOn: z.enum(RESET_TRIGGERS),
  })
  .refine((resource) => resource.current <= resource.maximum, { error: "current exceeds maximum" });

/**
 * A pool of uses a class table prints, such as Rages or Ki Points, keyed by its class and the
 * table's `resource_key`. Counted as uses spent rather than left, because a null `maximum`,
 * the `Unlimited` a level 20 barbarian's rages print, leaves nothing to count down from.
 */
const classResourceSchema = z
  .strictObject({
    class: entryRefSchema,
    key: z.string().min(1),
    maximum: z.int().min(1).nullable(),
    expended: z.int().min(0),
  })
  .refine((pool) => pool.maximum === null || pool.expended <= pool.maximum, {
    error: "expended exceeds maximum",
  });

/**
 * The uses spent of a feature with limited uses, such as Relentless Endurance, keyed by
 * `featureUsesKey`. The maximum is the catalog's, so it is not stored and nothing here caps
 * what is spent; a reader caps it at the maximum the features endpoint shows.
 */
const featureUseSchema = z.strictObject({
  key: z.string().min(1),
  expended: z.int().min(0),
});

/**
 * Something in force until the user ends it, such as a rage. Keyed by `name`, so a second
 * effect needs no change to this shape; what an effect does is the rule that reads the name.
 */
const activeEffectSchema = z.strictObject({ name: z.string().min(1) });

/**
 * The spell a character concentrates on and the level it took effect at: the slot level for a
 * slot cast, the spell's own level for a slotless one, 0 for a cantrip. The level is kept
 * because an upcast spell is a different effect from the same row.
 */
const concentrationSchema = z.strictObject({
  spell: entryRefSchema,
  level: z.int().min(0).max(9),
});

/**
 * A reduction to the hit point maximum, such as a wraith's Life Drain, lasting until a long rest
 * or, where `clearsOnLongRest` is false, until the player clears it.
 */
const hitPointMaximumReductionSchema = z.strictObject({
  amount: z.int().min(1),
  clearsOnLongRest: z.boolean(),
});

const deathSavesSchema = z.strictObject({
  successes: z.int().min(0).max(3).default(0),
  failures: z.int().min(0).max(3).default(0),
});

/** The catalog's spelling in both rulesets. The list matches the name alone, so no source can smuggle in a second one. */
const EXHAUSTION = "Exhaustion";

export const characterStateSchema = z.strictObject({
  hitPoints: hitPointsSchema,
  /** One reduction at most; a second one changes its amount. */
  hitPointMaximumReduction: hitPointMaximumReductionSchema.nullable().default(null),
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
  /** A table's own condition, such as "Marked", that the catalog lacks; it has a name and no rules. */
  customConditions: z
    .array(z.string().trim().min(1))
    .refine((names) => isUnique(names, (name) => name.toLowerCase()), {
      error: "the same custom condition is listed twice",
    })
    .refine((names) => names.every((name) => name.toLowerCase() !== EXHAUSTION.toLowerCase()), {
      error: "exhaustion is held as a level, not a custom condition",
    })
    .default([]),
  resources: z.array(resourceSchema),
  classResources: z
    .array(classResourceSchema)
    .refine((pools) => isUnique(pools, classResourceKey), {
      error: "the same class resource is listed twice",
    })
    .default([]),
  featureUses: z
    .array(featureUseSchema)
    .refine((uses) => isUnique(uses, (use) => use.key), {
      error: "the same feature is listed twice",
    })
    .default([]),
  activeEffects: z
    .array(activeEffectSchema)
    .refine((effects) => isUnique(effects, (effect) => effect.name), {
      error: "the same effect is listed twice",
    })
    .default([]),
  /** One spell at most; a state stored before concentration holds none. */
  concentration: concentrationSchema.nullable().default(null),
  deathSaves: deathSavesSchema,
  exhaustion: z.int().min(0).max(6).default(0),
  /** One inspiration held or not; a count above one is a different rule. */
  inspiration: z.boolean().default(false),
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

export type Concentration = z.infer<typeof concentrationSchema>;

export type HitPointMaximumReduction = z.infer<typeof hitPointMaximumReductionSchema>;

/**
 * One feature's spent uses, capped at its count: a spent count past it, left by a catalog whose
 * count has since fallen, reads as none left.
 */
export function featureUsesSpent(state: CharacterState, key: string, count: number): number {
  const expended = state.featureUses.find((use) => use.key === key)?.expended ?? 0;
  return Math.min(expended, count);
}

/** The state with one feature's spent uses replaced, or added where state holds none for it. */
export function withFeatureUse(
  state: CharacterState,
  key: string,
  expended: number,
): CharacterState {
  const others = state.featureUses.filter((use) => use.key !== key);
  return { ...state, featureUses: [...others, { key, expended }] };
}
