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
import { RESET_TRIGGERS } from "@dnd/rules";
import { z } from "zod";

export const editionSchema = z.enum(["classic", "one"]);

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const abilitySchema = z.enum(ABILITIES);

/** Strict: a union of open objects would silently strip the keys of the other branch. */
export const contentRefSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
});

export const homebrewRefSchema = z.strictObject({ homebrewId: z.string().min(1) });

/** Anything a character can point at: a catalog row, or a row in `homebrew.db`. */
export const entryRefSchema = z.union([contentRefSchema, homebrewRefSchema]);

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

export const classEntrySchema = z.object({
  class: contentRefSchema,
  subclass: contentRefSchema.optional(),
  level: z.int().min(1).max(20),
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
  classes: z
    .array(classEntrySchema)
    .min(1)
    .refine((classes) => isUnique(classes, (c) => `${c.class.name}|${c.class.source}`), {
      error: "the same class is listed twice",
    })
    .refine((classes) => classes.reduce((sum, c) => sum + c.level, 0) <= 20, {
      error: "total character level exceeds 20",
    }),
  race: contentRefSchema,
  background: contentRefSchema,
  abilityScores: abilityScoresSchema,
  proficiencies: proficienciesSchema,
  inventory: z.array(inventoryEntrySchema),
  spells: z.array(spellEntrySchema),
});

export const totalLevel = (definition: CharacterDefinition): number =>
  definition.classes.reduce((sum, entry) => sum + entry.level, 0);

// State ----------------------------------------------------------------------

export const hitPointsSchema = z.object({
  current: z.int(),
  temporary: z.int().min(0).default(0),
});

/** Grouped by die size, not by class: two d8 classes share one pool at rest. */
export const hitDicePoolSchema = z
  .object({
    die: z.literal([6, 8, 10, 12]),
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

export type Edition = z.infer<typeof editionSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type ContentRef = z.infer<typeof contentRefSchema>;
export type EntryRef = z.infer<typeof entryRefSchema>;
export type ClassEntry = z.infer<typeof classEntrySchema>;
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
