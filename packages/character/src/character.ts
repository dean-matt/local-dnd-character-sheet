/**
 * The shape of a character, split the way the database is split.
 *
 *   CharacterDefinition   who the character is — stored in `characters.definition`
 *   CharacterState        what is true right now — stored in `character_state.state`
 *   Derived<T>            a number the sheet computes, plus the value a user typed
 *                         over it — the computed side is never overwritten
 *
 * Catalog content is referenced by `(name, source)` and never copied, so
 * rebuilding `content.db` updates every character. Homebrew is the exception:
 * nothing else owns it, so it is referenced by its row id.
 */
import {
  abilityModifier,
  EDITIONS,
  HIT_DICE,
  type HitDie,
  maxHitPoints,
  RESET_TRIGGERS,
} from "@dnd/rules";
import { z } from "zod";

export const editionSchema = z.enum(EDITIONS);

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const abilitySchema = z.enum(ABILITIES);

/** Strict: a union of open objects would silently strip the keys of the other branch. */
export const contentRefSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
});

export const homebrewRefSchema = z.strictObject({ homebrewId: z.string().min(1) });

export const entryRefSchema = z.union([contentRefSchema, homebrewRefSchema]);

/** The identity of a catalog row, flattened so a Map or a Set can hold it. */
export const refKey = (ref: ContentRef): string => `${ref.name}|${ref.source}`;

/**
 * A computed field a user may have typed over. A null `manual` is the absent
 * `field_overrides` row: use the computed value. There is no third state,
 * because the table has nowhere to hold a manual value that is switched off.
 *
 * Writing `manual` never touches `computed`, so a level-up recomputes without
 * stomping the edit.
 */
export function derivedSchema<T extends z.ZodType>(value: T) {
  return z.object({
    computed: value,
    manual: value.nullable().default(null),
  });
}

export type Derived<T> = { computed: T; manual: T | null };

export function derivedValue<T>(field: Derived<T>): T {
  return field.manual ?? field.computed;
}

// Definition -----------------------------------------------------------------

/** Rejects a list naming the same thing twice, where a duplicate would double-count. */
const isUnique = <T>(items: T[], key: (item: T) => string): boolean =>
  new Set(items.map(key)).size === items.length;

/**
 * One level, in the order it was taken. A level count per class would make Wizard 1 /
 * Fighter 1 and Fighter 1 / Wizard 1 the same record, where the second is worth 2 more
 * hit points under the rule that the first level takes its die's highest face.
 *
 * `subclass` sits on the level it was chosen at, so a class names it once.
 */
export const levelEntrySchema = z.object({
  class: contentRefSchema,
  subclass: contentRefSchema.optional(),
  /**
   * The roll taken in place of the class table's fixed value. Bounded here by the
   * largest hit die, because the schema cannot reach the catalog for this class's own
   * die — `maxHitPoints` rejects a roll the die cannot make.
   */
  rolled: z
    .int()
    .min(1)
    .max(Math.max(...HIT_DICE))
    .optional(),
});

/** Exhaustive: a record keyed by an enum requires every ability to be present. */
export const abilityScoresSchema = z.record(abilitySchema, z.int().min(1).max(30));

export const proficienciesSchema = z.object({
  savingThrows: z.array(abilitySchema),
  skills: z.array(z.string().min(1)),
  armor: z.array(z.string().min(1)),
  weapons: z.array(z.string().min(1)),
  tools: z.array(z.string().min(1)),
  languages: z.array(z.string().min(1)),
});

export const inventoryEntrySchema = z.object({
  ref: entryRefSchema,
  quantity: z.int().min(1).default(1),
  equipped: z.boolean().default(false),
  attuned: z.boolean().default(false),
});

export const spellEntrySchema = z.object({
  ref: entryRefSchema,
  prepared: z.boolean().default(false),
  /** The class that granted it, for save DC and slot bookkeeping when multiclassed. */
  origin: contentRefSchema.optional(),
});

export const characterDefinitionSchema = z.object({
  name: z.string().min(1),
  edition: editionSchema,
  levels: z
    .array(levelEntrySchema)
    .min(1)
    .max(20)
    .refine(
      (levels) =>
        isUnique(
          levels.filter((level) => level.subclass !== undefined),
          (level) => refKey(level.class),
        ),
      { error: "a class names a subclass on more than one level" },
    ),
  race: contentRefSchema,
  background: contentRefSchema,
  abilityScores: abilityScoresSchema,
  proficiencies: proficienciesSchema,
  inventory: z.array(inventoryEntrySchema),
  spells: z.array(spellEntrySchema),
});

export const totalLevel = (definition: CharacterDefinition): number => definition.levels.length;

// State ----------------------------------------------------------------------

export const hitPointsSchema = z.object({
  current: z.int(),
  temporary: z.int().min(0).default(0),
});

/** Grouped by die size, not by class: two d8 classes share one pool at rest. */
export const hitDicePoolSchema = z
  .object({
    die: z.literal(HIT_DICE),
    total: z.int().min(0),
    remaining: z.int().min(0),
  })
  .refine((pool) => pool.remaining <= pool.total, { error: "remaining exceeds total" });

export const spellSlotSchema = z
  .object({
    level: z.int().min(1).max(9),
    total: z.int().min(0),
    expended: z.int().min(0),
  })
  .refine((slot) => slot.expended <= slot.total, { error: "expended exceeds total" });

/** Class resources and user-invented counters share one shape, so neither needs special casing. */
export const resourceSchema = z
  .object({
    name: z.string().min(1),
    current: z.int().min(0),
    maximum: z.int().min(0),
    resetsOn: z.enum(RESET_TRIGGERS),
  })
  .refine((resource) => resource.current <= resource.maximum, { error: "current exceeds maximum" });

export const deathSavesSchema = z.object({
  successes: z.int().min(0).max(3).default(0),
  failures: z.int().min(0).max(3).default(0),
});

export const characterStateSchema = z.object({
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
  conditions: z.array(contentRefSchema),
  resources: z.array(resourceSchema),
  deathSaves: deathSavesSchema,
  exhaustion: z.int().min(0).max(6).default(0),
});

// Derived --------------------------------------------------------------------

/**
 * Numbers the sheet computes, each beside the value a user typed over it. Assembled
 * on read rather than stored: `computed` comes from the definition and `manual` from
 * `field_overrides`.
 */
export const characterDerivedSchema = z.object({
  hitPointMaximum: derivedSchema(z.int().min(1)),
});

/**
 * The hit point maximum for a stored character.
 *
 * `hitDice` maps a class to its die, keyed by `refKey`, because the die is catalog
 * data a character references rather than copies. A class the map does not name is
 * rejected rather than defaulted, since a guessed die invents hit points.
 */
export function hitPointMaximum(
  definition: CharacterDefinition,
  hitDice: ReadonlyMap<string, HitDie>,
): number {
  const levels = definition.levels.map((level) => {
    const die = hitDice.get(refKey(level.class));
    if (die === undefined) {
      throw new RangeError(`No hit die for ${level.class.name} (${level.class.source})`);
    }
    return { die, rolled: level.rolled };
  });
  return maxHitPoints(levels, abilityModifier(definition.abilityScores.con));
}

export type Edition = z.infer<typeof editionSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type ContentRef = z.infer<typeof contentRefSchema>;
export type EntryRef = z.infer<typeof entryRefSchema>;
export type LevelEntry = z.infer<typeof levelEntrySchema>;
export type AbilityScores = z.infer<typeof abilityScoresSchema>;
export type Proficiencies = z.infer<typeof proficienciesSchema>;
export type InventoryEntry = z.infer<typeof inventoryEntrySchema>;
export type SpellEntry = z.infer<typeof spellEntrySchema>;
export type CharacterDefinition = z.infer<typeof characterDefinitionSchema>;
export type HitPoints = z.infer<typeof hitPointsSchema>;
export type HitDicePool = z.infer<typeof hitDicePoolSchema>;
export type SpellSlot = z.infer<typeof spellSlotSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type DeathSaves = z.infer<typeof deathSavesSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
export type CharacterDerived = z.infer<typeof characterDerivedSchema>;
