import { HIT_DICE, RESET_TRIGGERS } from "@dnd/rules";
import { z } from "zod";
import { classResourceKey, isUnique, itemKey, refKey } from "./keys.ts";
import {
  abilitySchema,
  type ContentRef,
  contentRefSchema,
  type EntryRef,
  entryRefSchema,
} from "./refs.ts";

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
 * The charges spent from one inventory entry's item, keyed by the entry's `id`. The maximum
 * is the sheet's, so a reader caps what is spent at it.
 */
const itemChargeSchema = z.strictObject({
  id: z.string().min(1),
  expended: z.int().min(1),
});

/**
 * Pieces of one kind of ammunition fired and not yet recovered. `type` is the ammunition uid
 * the weapon fires, and `ref` and `variant` name the item the piece came from, so a recovery
 * can add it back where no stack of it remains.
 */
const spentAmmunitionSchema = z.strictObject({
  type: z.string().min(1),
  ref: entryRefSchema,
  variant: contentRefSchema.optional(),
  count: z.int().min(1),
});

/**
 * Something in force until the user ends it, such as a rage. Keyed by `name`, so a second
 * effect needs no change to this shape; what an effect does is the rule that reads the name.
 */
const activeEffectSchema = z.strictObject({ name: z.string().min(1) });

/** Far past any fight, so a round counter left running stays a small number. */
export const MAX_ROUND = 999;

/**
 * The encounter the character is in: its round, from 1, and the initiative rolled for it.
 * Session state, ended by the player, never an audit trail.
 */
const encounterSchema = z.strictObject({
  round: z.int().min(1).max(MAX_ROUND),
  initiative: z.int().nullable().default(null),
});

/**
 * What the character has used this turn, each mark spent or not. Session state for the current
 * turn only, never a history.
 */
export const TURN_MARKS = ["action", "bonusAction", "reaction", "movement"] as const;
export type TurnMark = (typeof TURN_MARKS)[number];

const turnSchema = z.strictObject({
  action: z.boolean().default(false),
  bonusAction: z.boolean().default(false),
  reaction: z.boolean().default(false),
  movement: z.boolean().default(false),
});

/** Every mark available, the turn a character starts with. */
export const TURN_AVAILABLE: z.infer<typeof turnSchema> = turnSchema.parse({});

/**
 * The spell a character concentrates on and the level it took effect at: the slot level for a
 * slot cast, the spell's own level for a slotless one, 0 for a cantrip. The level is kept
 * because an upcast spell is a different effect from the same row.
 */
const concentrationSchema = z.strictObject({
  spell: entryRefSchema,
  level: z.int().min(0).max(9),
  /** The encounter round it took effect in; absent where no encounter was running. */
  round: z.int().min(1).max(MAX_ROUND).optional(),
});

/**
 * A reduction to the hit point maximum, such as a wraith's Life Drain, lasting until a long rest
 * or, where `clearsOnLongRest` is false, until the player clears it.
 */
const hitPointMaximumReductionSchema = z.strictObject({
  amount: z.int().min(1),
  clearsOnLongRest: z.boolean(),
});

/**
 * The sheet value a temporary modifier moves: one saving throw, one skill, every ability
 * check (the skills and initiative), every attack roll, or one of the three scalars.
 */
const modifierTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("armorClass") }),
  z.strictObject({ kind: z.literal("save"), ability: abilitySchema }),
  z.strictObject({ kind: z.literal("check") }),
  z.strictObject({ kind: z.literal("skill"), ref: contentRefSchema }),
  z.strictObject({ kind: z.literal("attackRolls") }),
  z.strictObject({ kind: z.literal("speed") }),
  z.strictObject({ kind: z.literal("hitPointMaximum") }),
]);

/**
 * A named, signed amount the player adds to one sheet value, such as a curse's -1 to armor
 * class. It lasts until removed or, where `endsOn` names a rest, until a rest that meets it:
 * `short` ends on any rest, `long` on a long rest only.
 */
/** The label of the term a reduction adds to the hit point maximum's breakdown, which no modifier may take. */
export const REDUCTION_LABEL = "Maximum reduction";

export const temporaryModifierSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .refine((name) => name.toLowerCase() !== REDUCTION_LABEL.toLowerCase(), {
      error: "that name is the hit point maximum reduction's",
    }),
  target: modifierTargetSchema,
  amount: z.int().refine((amount) => amount !== 0, { error: "a modifier of 0 changes nothing" }),
  endsOn: z.enum(["short", "long"]).nullable(),
});

export type TemporaryModifier = z.infer<typeof temporaryModifierSchema>;

/** What a modifier is told apart by: its name and the value it moves. */
export const modifierKey = ({ name, target }: Pick<TemporaryModifier, "name" | "target">) =>
  `${name.toLowerCase()}|${target.kind}|${
    target.kind === "save" ? target.ability : target.kind === "skill" ? refKey(target.ref) : ""
  }`;

const deathSavesSchema = z.strictObject({
  successes: z.int().min(0).max(3).default(0),
  failures: z.int().min(0).max(3).default(0),
});

/** The catalog's spelling in both rulesets. The list matches the name alone, so no source can smuggle in a second one. */
const EXHAUSTION = "Exhaustion";

const spentAmmunitionKey = (spent: {
  type: string;
  ref: EntryRef;
  variant?: ContentRef | undefined;
}) => `${spent.type}|${itemKey(spent)}`;

/** The die sizes a bard's Bardic Inspiration grants, from a d6 to a d12. */
export const BARDIC_INSPIRATION_DICE = [6, 8, 10, 12] as const;

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
  itemCharges: z
    .array(itemChargeSchema)
    .refine((charges) => isUnique(charges, (spent) => spent.id), {
      error: "the same item is listed twice",
    })
    .default([]),
  spentAmmunition: z
    .array(spentAmmunitionSchema)
    .refine((spent) => isUnique(spent, spentAmmunitionKey), {
      error: "the same ammunition is listed twice",
    })
    .default([]),
  activeEffects: z
    .array(activeEffectSchema)
    .refine((effects) => isUnique(effects, (effect) => effect.name), {
      error: "the same effect is listed twice",
    })
    .default([]),
  temporaryModifiers: z
    .array(temporaryModifierSchema)
    .refine((modifiers) => isUnique(modifiers, modifierKey), {
      error: "the same modifier is listed twice",
    })
    .default([]),
  /** One spell at most; a state stored before concentration holds none. */
  concentration: concentrationSchema.nullable().default(null),
  /** None where no encounter is running. */
  encounter: encounterSchema.nullable().default(null),
  turn: turnSchema.default(TURN_AVAILABLE),
  deathSaves: deathSavesSchema,
  exhaustion: z.int().min(0).max(6).default(0),
  /** One inspiration held or not; a count above one is a different rule. */
  inspiration: z.boolean().default(false),
  /** The size of the one Bardic Inspiration die held until used; null where none is held. */
  bardicInspiration: z
    .union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)])
    .nullable()
    .default(null),
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

export type SpentAmmunition = z.infer<typeof spentAmmunitionSchema>;

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

/** One entry's spent charges, capped at its maximum: a count past it, left by a lowered maximum, reads as none left. */
export function itemChargesSpent(state: CharacterState, id: string, max: number): number {
  const expended = state.itemCharges.find((spent) => spent.id === id)?.expended ?? 0;
  return Math.min(expended, max);
}

/**
 * The state with one entry's spent charges replaced. A counter whose id is not in `ids`, the
 * entries the definition lists, is dropped, which is how removing an entry removes its
 * counter; one at nothing spent is not stored.
 */
export function withItemChargesSpent(
  state: CharacterState,
  ids: ReadonlySet<string>,
  id: string,
  expended: number,
): CharacterState {
  const others = state.itemCharges.filter((spent) => spent.id !== id && ids.has(spent.id));
  return { ...state, itemCharges: expended > 0 ? [...others, { id, expended }] : others };
}

/** The first piece fired of ammunition `type` and not yet recovered, or undefined where none is. */
export function spentAmmunitionOf(
  state: CharacterState,
  type: string,
): SpentAmmunition | undefined {
  return state.spentAmmunition.find((spent) => spent.type === type);
}

/** The state with one more piece of `piece` recorded as fired, or one fewer where `change` is -1; a count at zero is not stored, and recovering a piece not recorded throws. */
export function withAmmunitionSpent(
  state: CharacterState,
  piece: Omit<SpentAmmunition, "count">,
  change: 1 | -1,
): CharacterState {
  const key = spentAmmunitionKey(piece);
  const held = state.spentAmmunition.find((spent) => spentAmmunitionKey(spent) === key);
  if (!held && change < 0) throw new Error("no such ammunition is recorded as fired");
  const count = (held?.count ?? 0) + change;
  const others = state.spentAmmunition.filter((spent) => spentAmmunitionKey(spent) !== key);
  return { ...state, spentAmmunition: count > 0 ? [...others, { ...piece, count }] : others };
}
