/**
 * The shape of a character, split the way the database is split.
 *
 *   CharacterDefinition   who the character is — stored in `characters.definition`
 *   CharacterState        what is true right now — stored in `character_state.state`
 *   Derived<T>            what the sheet computes, plus the value a user typed
 *                         over it — the computed side is never overwritten
 *
 * Catalog content is referenced by `(name, source)` and never copied, so
 * rebuilding `content.db` updates every character. Homebrew is the exception:
 * nothing else owns it, so it is referenced by its row id.
 *
 * Every object here is strict. The sheet reads a definition or a state out of a JSON
 * column, edits it and writes the whole column back, so an open object drops a key it
 * does not name and the next save deletes that key from the database. Refusing the row
 * loses nothing and says so. The derived tree is assembled rather than stored, and
 * strict for the plainer reason: a key nothing named means the caller built it wrong.
 */
import {
  abilityModifier,
  EDITIONS,
  HIT_DICE,
  type HitDie,
  maxHitPoints,
  RESET_TRIGGERS,
  SIZES,
} from "@dnd/rules";
import { z } from "zod";

const editionSchema = z.enum(EDITIONS);

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const abilitySchema = z.enum(ABILITIES);

const contentRefSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
});

const homebrewRefSchema = z.strictObject({ homebrewId: z.string().min(1) });

/**
 * A deity, keyed by its pantheon as well as `(name, source)`. Five `PHB` gods —
 * `Oghma`, `Silvanus`, `Surtur`, `Thrym` and `Tyr` — are each written twice under
 * different pantheons, so the pair alone names two rows.
 */
const deityRefSchema = contentRefSchema.extend({ pantheon: z.string().min(1) });

/** A union needs strictness doubly: open branches would each strip the keys of the other. */
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
  return z.strictObject({
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
const levelEntrySchema = z.strictObject({
  class: contentRefSchema,
  /**
   * The `subclasses` row's own name — `Fiend Patron`, not the `Fiend` its features and
   * tags spell. A character names a row by that row's key, and the short name keys no
   * `subclasses` row; it keys the features instead, and the catalog carries it as
   * `subclasses.short_name` so a sheet reaches them through the subclass. The level's
   * own class supplies the other two parts of that key.
   */
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

const proficienciesSchema = z.strictObject({
  savingThrows: z.array(abilitySchema),
  skills: z.array(z.string().min(1)),
  armor: z.array(z.string().min(1)),
  weapons: z.array(z.string().min(1)),
  tools: z.array(z.string().min(1)),
  languages: z.array(z.string().min(1)),
});

const inventoryEntrySchema = z.strictObject({
  ref: entryRefSchema,
  quantity: z.int().min(1).default(1),
  equipped: z.boolean().default(false),
  attuned: z.boolean().default(false),
});

const spellEntrySchema = z.strictObject({
  ref: entryRefSchema,
  prepared: z.boolean().default(false),
  /** The class that granted it, for save DC and slot bookkeeping when multiclassed. */
  origin: contentRefSchema.optional(),
});

/**
 * A reference flattened for comparison, tagged so a homebrew id cannot spell a catalog
 * pair.
 */
const entryKey = (ref: EntryRef): string =>
  "homebrewId" in ref ? `homebrew|${ref.homebrewId}` : `catalog|${refKey(ref)}`;

/**
 * What entitled a pick, in the shape the table holding that entitlement is keyed on.
 *
 * A subclass names its class because `subclass_optional_features` keys on both, and 124
 * of the 198 upstream subclass rows answer to more than one class — `Path of the
 * Berserker` (PHB) to `Barbarian` (PHB) and `Barbarian` (XPHB) alike.
 *
 * An optional feature grants as readily as a feat does: `Superior Technique` (TCE) is a
 * fighting style that grants a maneuver. No background and no race grants one at the
 * pinned tag, so neither is a kind a character can store.
 */
const grantorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("class"), ref: contentRefSchema }),
  z.strictObject({
    kind: z.literal("subclass"),
    ref: contentRefSchema,
    class: contentRefSchema,
  }),
  z.strictObject({ kind: z.literal("feat"), ref: entryRefSchema }),
  z.strictObject({ kind: z.literal("optionalFeature"), ref: entryRefSchema }),
]);

const optionalFeatureEntrySchema = z.strictObject({
  ref: entryRefSchema,
  /**
   * The code the catalog keys on — `FS:F`, `MV:B` — rather than the label a sheet
   * prints. 9 of the 213 upstream options carry more than one, `Dueling` (PHB) under all
   * four fighting-style classes, so the type says which entitlement a pick spends.
   */
  featureType: z.string().min(1),
  grantedBy: grantorSchema,
});

/**
 * Coins, counted per denomination. A single converted total would lose which coins the
 * character holds, and a party splitting treasure divides the coins rather than the
 * total. Exchanging denominations is a rule, and belongs in `@dnd/rules` the day
 * something needs it.
 */
const moneySchema = z
  .strictObject({
    copper: z.int().min(0).default(0),
    silver: z.int().min(0).default(0),
    electrum: z.int().min(0).default(0),
    gold: z.int().min(0).default(0),
    platinum: z.int().min(0).default(0),
  })
  .prefault({});

/** The boxes the printed sheet has, each absent until a player fills it in. */
const appearanceSchema = z
  .strictObject({
    age: z.string().min(1).optional(),
    height: z.string().min(1).optional(),
    weight: z.string().min(1).optional(),
    eyes: z.string().min(1).optional(),
    skin: z.string().min(1).optional(),
    hair: z.string().min(1).optional(),
  })
  .prefault({});

export const characterDefinitionSchema = z.strictObject({
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
  /**
   * The subrace's own name — `High`, not `Elf (High)`. The race supplies the other two
   * parts of the `subraces` key, because `(name, source)` alone collides three times
   * across the 98 upstream rows.
   *
   * An absent `subrace` is a race taken plain, which is all a character can store for
   * the five `PHB` races whose base variant upstream leaves unnamed: their row is keyed
   * on the empty string, and a reader reaches it from the race.
   */
  subrace: contentRefSchema.optional(),
  background: contentRefSchema,
  abilityScores: abilityScoresSchema,
  proficiencies: proficienciesSchema,
  inventory: z.array(inventoryEntrySchema),
  spells: z.array(spellEntrySchema),
  /**
   * The 2024 ruleset repeats `Ability Score Improvement` (XPHB), so the list accepts a
   * duplicate that a uniqueness rule would make unstorable.
   */
  feats: z.array(entryRefSchema).default([]),
  optionalFeatures: z
    .array(optionalFeatureEntrySchema)
    .refine((picks) => isUnique(picks, (pick) => `${pick.featureType}|${entryKey(pick.ref)}`), {
      error: "the same option is picked twice under one feature type",
    })
    .default([]),
  deity: deityRefSchema.optional(),
  /**
   * Free text rather than an enum: the 2024 ruleset drops alignment from character
   * creation, and a setting is free to invent its own, so a closed list would make a
   * legal character unstorable.
   */
  alignment: z.string().min(1).optional(),
  money: moneySchema,
  appearance: appearanceSchema,
  /** Whatever the player writes down, unbounded and stored verbatim. */
  notes: z.string().default(""),
});

export const totalLevel = (definition: CharacterDefinition): number => definition.levels.length;

// State ----------------------------------------------------------------------

const hitPointsSchema = z.strictObject({
  current: z.int(),
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

// Derived --------------------------------------------------------------------

/**
 * Feet per round, by movement mode. Every race grants a walking speed, so `walk` is
 * required and the rest stay absent until a race grants them. No upstream race grants a
 * burrowing speed, so an override is the only thing that reaches `burrow`.
 *
 * Upstream spells a mode equal to the walking speed as `true`, which the caller resolves.
 */
const speedSchema = z.strictObject({
  walk: z.int().min(0),
  burrow: z.int().min(0).optional(),
  climb: z.int().min(0).optional(),
  fly: z.int().min(0).optional(),
  swim: z.int().min(0).optional(),
});

/**
 * What the sheet computes, each beside the value a user typed over it. Assembled on
 * read rather than stored: `computed` comes from the definition and the catalog rows it
 * names, `manual` from `field_overrides`.
 */
export const characterDerivedSchema = z.strictObject({
  hitPointMaximum: derivedSchema(z.int().min(1)),
  /**
   * The race's size, in the vocabulary `carryingCapacity` reads, so the two cannot
   * drift. A subrace never states one — all 98 upstream rows leave it to the race — so
   * a race change moves it and nothing else does.
   */
  size: derivedSchema(z.enum(SIZES)),
  /**
   * The race's speeds, one field rather than one per mode because a subrace that states
   * a speed replaces the set outright rather than adding to it — a Wood Elf walks 35
   * feet, not the Elf's 30 and 5 more.
   */
  speed: derivedSchema(speedSchema),
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

type EntryRef = z.infer<typeof entryRefSchema>;
export type ContentRef = z.infer<typeof contentRefSchema>;
export type CharacterDefinition = z.infer<typeof characterDefinitionSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
