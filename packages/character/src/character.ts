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
  ABILITIES,
  abilityModifier,
  armorClass,
  type Breakdown,
  breakdown,
  EDITIONS,
  encumbranceAt,
  HIT_DICE,
  type HitDie,
  maxHitPoints,
  POUNDS_PER_COIN,
  PROFICIENCY_LEVELS,
  passiveScore,
  proficiencyBonus,
  proficiencyContribution,
  RESET_TRIGGERS,
  reducedSpeed,
  SIZES,
  type Size,
  spellAttackBonus,
  spellSaveDc,
  type Term,
} from "@dnd/rules";

export { ABILITIES };

import { z } from "zod";

const editionSchema = z.enum(EDITIONS);

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
 *
 * `terms` is the breakdown behind `computed`, empty where the field is not yet
 * assembled from one. An override needs no explanation beyond itself, so nothing
 * here recomputes `terms` against `manual`.
 */
export function derivedSchema<T extends z.ZodType>(value: T) {
  return z.strictObject({
    computed: value,
    manual: value.nullable().default(null),
    terms: z.array(termSchema).default([]),
  });
}

export type Derived<T> = { computed: T; manual: T | null; terms?: Term<TermReference>[] };

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
  class: entryRefSchema,
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

const proficiencyLevelSchema = z.enum(PROFICIENCY_LEVELS);

/** One skill, and how proficient the character is in it. */
const skillProficiencySchema = z.strictObject({
  ref: contentRefSchema,
  level: proficiencyLevelSchema,
});

/**
 * A tool, named rather than referenced: proficiency in `Artisan's Tools` names the whole
 * group, which upstream spells as an item type rather than an `items` row. The level is
 * here because expertise reaches tools — a rogue takes it in Thieves' Tools — and that is
 * what separates this field from `armor` and `weapons`.
 */
const toolProficiencySchema = z.strictObject({
  name: z.string().min(1),
  level: proficiencyLevelSchema,
});

/**
 * The two halves are shaped differently because what they hold is. A skill and a language
 * are catalog rows, doubled across the editions and further still by every setting that
 * reprints them — `Common` is seven rows — so a name alone picks one arbitrarily and no
 * `{@skill}` or `{@language}` token can resolve against it.
 *
 * `armor` and `weapons` stay strings because they are categories an item's `type` names
 * rather than rows: `Light` covers every suit of light armor, where a reference would
 * name one suit and grant proficiency in nothing else.
 */
const proficienciesSchema = z.strictObject({
  savingThrows: z.array(abilitySchema),
  skills: z
    .array(skillProficiencySchema)
    .refine((skills) => isUnique(skills, (skill) => refKey(skill.ref)), {
      error: "the same skill is listed twice",
    }),
  armor: z.array(z.string().min(1)),
  weapons: z.array(z.string().min(1)),
  tools: z.array(toolProficiencySchema).refine((tools) => isUnique(tools, (tool) => tool.name), {
    error: "the same tool is listed twice",
  }),
  languages: z.array(contentRefSchema).refine((languages) => isUnique(languages, refKey), {
    error: "the same language is listed twice",
  }),
});

/**
 * `carried` is a flag rather than a reference to a container, because an entry has no
 * identity a reference could name: two rows may hold the same `ref`, so pointing at one
 * means giving every entry an id, and nothing yet reads the grouping that id would buy.
 * The weight sum asks only whether a thing is on the character, and a container that
 * changes the weight it holds is magic-item behavior rather than the carrying rule. A
 * reference stays open the day a sheet groups a pack by the bag it sits in.
 *
 * It is not `equipped`, which means worn or wielded: a rope in the pack is carried and
 * unequipped, a sword left in the cart is neither. A wielded sword is always on the
 * character, so the refinement refuses an equipped entry left behind.
 *
 * It defaults true where the other flags default false: an entry naming no container is
 * a thing the character has on them.
 *
 * `variant` names a `magicvariant` the API expands against `ref` at read time — `+1
 * Chain Mail` is stored as a `Chain Mail` ref and a `+1 Weapon` variant, never as the
 * expanded item, so a catalog rebuild still updates it. It pairs only with a catalog
 * `ref`: expansion reads the base item's own fields in the shape `inherits` expects, and
 * a homebrew row does not carry them.
 */
const inventoryEntrySchema = z
  .strictObject({
    ref: entryRefSchema,
    variant: contentRefSchema.optional(),
    quantity: z.int().min(1).default(1),
    carried: z.boolean().default(true),
    equipped: z.boolean().default(false),
    attuned: z.boolean().default(false),
  })
  .refine((entry) => entry.carried || !entry.equipped, {
    error: "an item is equipped but not carried",
  })
  .refine((entry) => entry.variant === undefined || !("homebrewId" in entry.ref), {
    error: "a magic variant expands a catalog base item, not a homebrew one",
  });

const spellEntrySchema = z.strictObject({
  ref: entryRefSchema,
  prepared: z.boolean().default(false),
  /** The class that granted it, for save DC and slot bookkeeping when multiclassed. */
  origin: contentRefSchema.optional(),
});

/**
 * A reference flattened for comparison, tagged so a homebrew id cannot spell a catalog
 * pair. Exported because a caller building a catalog lookup for `carriedWeight` keys it
 * the same way.
 */
export const entryKey = (ref: EntryRef): string =>
  "homebrewId" in ref ? `homebrew|${ref.homebrewId}` : `catalog|${refKey(ref)}`;

/**
 * What entitled a pick, in the shape the table holding that entitlement is keyed on.
 *
 * A subclass names its class because `subclass_optional_features` keys on both, and 124
 * of the 198 upstream subclass rows answer to more than one class — `Path of the
 * Berserker` (PHB) to `Barbarian` (PHB) and `Barbarian` (XPHB) alike.
 */
const classGrantor = z.strictObject({ kind: z.literal("class"), ref: entryRefSchema });

const subclassGrantor = z.strictObject({
  kind: z.literal("subclass"),
  ref: contentRefSchema,
  class: contentRefSchema,
});

/**
 * What entitled an optional feature. One option grants another as readily as a feat does:
 * `Superior Technique` (TCE) is a fighting style that grants a maneuver. No background
 * and no race grants an option at the pinned tag, so neither is a kind a pick can store.
 */
const grantorSchema = z.discriminatedUnion("kind", [
  classGrantor,
  subclassGrantor,
  z.strictObject({ kind: z.literal("feat"), ref: entryRefSchema }),
  z.strictObject({ kind: z.literal("optionalFeature"), ref: entryRefSchema }),
]);

/**
 * What entitled a feat. A class and a subclass grant one as they grant an option —
 * `Fighting Style` on the `Fighter` (XPHB) table at level 1, `Additional Fighting Style`
 * on `Champion` (XPHB) at 7 — so those two branches are `grantorSchema`'s own rather
 * than a second spelling of them.
 *
 * Three more grant a feat and no option, which is why `grantorSchema` carries none of
 * them: 74 backgrounds, the `Custom Lineage` (TCE) and `Human` (XPHB) races, and the
 * `Variant` subrace of `Human` (PHB). A subrace names its race for the reason a subclass
 * names its class — `(name, source)` alone collides across the 98 upstream rows.
 *
 * No feat and no optional feature grants a feat at the pinned tag, so neither is a kind
 * this union carries.
 */
const featGrantorSchema = z.discriminatedUnion("kind", [
  classGrantor,
  subclassGrantor,
  z.strictObject({ kind: z.literal("background"), ref: entryRefSchema }),
  z.strictObject({ kind: z.literal("race"), ref: entryRefSchema }),
  z.strictObject({
    kind: z.literal("subrace"),
    ref: contentRefSchema,
    race: contentRefSchema,
  }),
]);

/**
 * One feat, what entitled it, and the level that spent that entitlement — a character
 * level, which is a position in `levels` rather than the grantor's own level a
 * multiclass character reaches later. The level tells two takings of a repeatable feat
 * apart: `Ability Score Improvement` (XPHB) taken twice is one reference under one
 * grantor. A background or a race grants at creation and states no level.
 *
 * A fighting style reaches this list on a 2024 character and `optionalFeatures` on a
 * classic one — `Archery` (XPHB) is an `FS` feat where `Archery` (PHB) is an `FS:F`
 * option — so both say which class entitlement the pick spends.
 *
 * A definition written before the grantor existed holds bare references, so an entry
 * that parses as one is read as a feat whose entitlement nothing recorded.
 */
const featEntrySchema = z.preprocess(
  (entry) => (entryRefSchema.safeParse(entry).success ? { ref: entry } : entry),
  z.strictObject({
    ref: entryRefSchema,
    grantedBy: featGrantorSchema.optional(),
    level: z.int().min(1).max(20).optional(),
  }),
);

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

/**
 * The rules this table plays differently. Every option names a rule the sheet computes,
 * so what the sheet implements bounds the vocabulary rather than what 5e prints:
 * flanking earns an option the day something computes it, and until then a table that
 * plays it writes a note.
 *
 * An option carries whatever type its rule needs rather than a flag. Encumbrance is on
 * or off, but a fixed hit point maximum per level is a number, and a critical that
 * maxes dice rather than rolling them twice is a mode.
 */
const houseRulesSchema = z
  .strictObject({
    /**
     * The 2014 encumbrance variant applies. It is a variant the table opts into and the
     * 2024 ruleset drops entirely, so absent, weight costs a creature no speed and
     * carrying capacity alone limits what it holds.
     */
    encumbrance: z.boolean().optional(),
    /**
     * Tasha's optional class features apply: the class and subclass feature rows the
     * catalog flags `isClassFeatureVariant`, such as `Martial Versatility` (TCE) on the
     * `Fighter` (PHB). Upstream prints them as a variant the table opts into, so absent,
     * a class grants only its own table's features. All or nothing, where a table picks
     * them one at a time and some replace a printed feature — `Deft Explorer` (TCE) for
     * `Natural Explorer` (PHB) — so turning it on lists both. The way out is a per-feature
     * pick on the definition.
     */
    optionalClassFeatures: z.boolean().optional(),
  })
  .prefault({});

type HouseRules = z.infer<typeof houseRulesSchema>;

export type HouseRule = keyof HouseRules;

/**
 * What an option the table has not set means. `Required` is what closes the vocabulary:
 * an option added above fails to compile until it names its printed value.
 */
const PRINTED_RULE: Required<HouseRules> = {
  encumbrance: false,
  optionalClassFeatures: false,
};

/**
 * How every reader asks. Reading `houseRules` directly restates the printed value at
 * each site — the duplication `derivedValue` also exists to prevent.
 *
 * One option at a time rather than a resolved set: a key written as `undefined` survives
 * the parse, so spreading the stored options over the printed ones would overwrite a
 * printed value with `undefined`.
 */
export function houseRule<K extends HouseRule>(
  definition: CharacterDefinition,
  rule: K,
): Required<HouseRules>[K] {
  // Both sides of the `??` index one mapped type through this annotation. Indexing
  // `definition.houseRules` directly compiles while every option is a boolean and stops
  // the day one is not, reporting the return rather than the read.
  const set: Partial<Required<HouseRules>> = definition.houseRules;
  return set[rule] ?? PRINTED_RULE[rule];
}

/**
 * What a `Term` traces to, the vocabulary `rules` never sees: a catalog row a
 * character references by `(name, source)`, another derived field on the same
 * character, or the house-rule option that changed the arithmetic instead of the
 * printed rule. `character` owns this union because it owns all three vocabularies.
 */
export type TermReference = ContentRef | { derivedField: string } | { houseRuleOption: HouseRule };

const termReferenceSchema = z.union([
  contentRefSchema,
  z.strictObject({ derivedField: z.string() }),
  z.strictObject({
    houseRuleOption: z.enum(Object.keys(PRINTED_RULE) as [HouseRule, ...HouseRule[]]),
  }),
]);

const termSchema = z.strictObject({
  label: z.string(),
  value: z.number(),
  reference: termReferenceSchema.optional(),
});

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
          (level) => entryKey(level.class),
        ),
      { error: "a class names a subclass on more than one level" },
    ),
  race: entryRefSchema,
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
  background: entryRefSchema,
  abilityScores: abilityScoresSchema,
  proficiencies: proficienciesSchema,
  inventory: z.array(inventoryEntrySchema),
  spells: z.array(spellEntrySchema),
  /**
   * The 2024 ruleset repeats `Ability Score Improvement` (XPHB), so the list accepts a
   * duplicate that a uniqueness rule would make unstorable.
   */
  feats: z.array(featEntrySchema).default([]),
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
  houseRules: houseRulesSchema,
});

export const totalLevel = (definition: CharacterDefinition): number => definition.levels.length;

/**
 * `race` and `levels[].class` carry only a `homebrewId` for a homebrew choice, and no
 * catalog reaches `packages/character` to resolve it to a name — the ceiling both
 * summaries below share.
 */
export const displayName = (ref: EntryRef): string => ("homebrewId" in ref ? "Homebrew" : ref.name);

/** The subrace's own name where one is chosen, the race's otherwise — `High`, not `Elf (High)`. */
export function raceSummary(definition: CharacterDefinition): string {
  return displayName(definition.subrace ?? definition.race);
}

/** One class a character has levels in, with the subclass named on any of those levels. */
type ClassLevels = { class: EntryRef; level: number; subclass?: ContentRef };

/** `levels` grouped by class, in the order each class was first taken. */
export function classLevels(definition: CharacterDefinition): ClassLevels[] {
  const groups = new Map<string, ClassLevels>();
  for (const level of definition.levels) {
    const key = entryKey(level.class);
    const group = groups.get(key) ?? { class: level.class, level: 0 };
    group.level += 1;
    if (level.subclass) group.subclass = level.subclass;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * `classLevels` joined the way `levelEntrySchema`'s own comment already writes a
 * multiclass character — `Wizard 1 / Fighter 1`. A single class carries no count.
 */
export function classSummary(definition: CharacterDefinition): string {
  const groups = classLevels(definition);
  const labels = groups.map((group) =>
    groups.length === 1 ? displayName(group.class) : `${displayName(group.class)} ${group.level}`,
  );
  return labels.join(" / ");
}

/**
 * A stored character, as an endpoint returns it. `name`, `edition`, `level`,
 * `raceSummary` and `classSummary` are denormalized projections of `definition`, kept
 * here so a caller never re-derives what the database already computed on write.
 */
export const characterRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: editionSchema,
  level: z.int().min(1),
  raceSummary: z.string(),
  classSummary: z.string(),
  definition: characterDefinitionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CharacterRecord = z.infer<typeof characterRecordSchema>;

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
 * tracked yet. `hitPoints.current` is 0 rather than a computed maximum, because that
 * maximum needs the catalog's hit dice, which this package never reaches — the first
 * read that has the catalog in hand sets it.
 */
export function defaultCharacterState(): CharacterState {
  return characterStateSchema.parse({
    hitPoints: { current: 0 },
    hitDice: [],
    spellSlots: [],
    conditions: [],
    resources: [],
    deathSaves: {},
  });
}

// Pages ----------------------------------------------------------------------

const SHEET_SECTIONS = ["abilities", "spells", "inventory", "features"] as const;

/** The whole sheet section a `section` block renders. */
const sectionBlockSchema = z.strictObject({
  kind: z.literal("section"),
  section: z.enum(SHEET_SECTIONS),
});

/**
 * The flat derived fields a `value` block can name — every `Derived<int>` on
 * `characterDerivedSchema` with no key of its own. `savingThrows`, `skills` and
 * `spellcasting` are keyed collections a block would need a second field to address,
 * and nothing renders them yet.
 */
const VALUE_BLOCK_FIELDS = [
  "hitPointMaximum",
  "armorClass",
  "initiative",
  "proficiencyBonus",
] as const;

/** One derived value, shown with the breakdown behind it rather than arithmetic of its own. */
const valueBlockSchema = z.strictObject({
  kind: z.literal("value"),
  field: z.enum(VALUE_BLOCK_FIELDS),
});

/** Which of the sheet's own lists a `list` block narrows. Abilities is not a list. */
const LIST_BLOCK_SOURCES = ["spells", "inventory", "features"] as const;

/**
 * A saved filter over a list the sheet already renders, never a snapshot of the rows
 * it matched. The facets stay an opaque bag until something reads them — narrowing by
 * level or type is a later change, not a new field here.
 */
const listBlockSchema = z.strictObject({
  kind: z.literal("list"),
  source: z.enum(LIST_BLOCK_SOURCES),
  filter: z.record(z.string(), z.unknown()).default({}),
});

/** A note in the same `{@tag}` markup a catalog row's prose carries. */
const textBlockSchema = z.strictObject({
  kind: z.literal("text"),
  text: z.string(),
});

/**
 * Every block kind this build renders. A new kind is one entry here and one in the web
 * package's block registry, never a switch in either.
 */
const KNOWN_PAGE_BLOCK_SCHEMAS = [
  sectionBlockSchema,
  valueBlockSchema,
  listBlockSchema,
  textBlockSchema,
] as const;

/**
 * A block a stored page holds that this build does not recognize — an older kind a
 * rollback still needs to read, or a row a hand edit wrote wrong. `raw` carries the
 * original data through unchanged, so a page that reads one and is later saved whole
 * does not delete it.
 */
const unknownBlockSchema = z.strictObject({
  kind: z.literal("unknown"),
  raw: z.unknown(),
});

/**
 * One unit of a page's content. Strict like the rest of the file: a write naming a kind
 * this build does not know is refused. Only `degradePageBlock` produces the `unknown`
 * branch, wrapping a block a write would refuse for a read that already found one stored.
 */
const pageBlockSchema = z.discriminatedUnion("kind", [
  ...KNOWN_PAGE_BLOCK_SCHEMAS,
  unknownBlockSchema,
]);

export type PageBlock = z.infer<typeof pageBlockSchema>;
export type ValueBlockField = (typeof VALUE_BLOCK_FIELDS)[number];
export type ListBlockSource = (typeof LIST_BLOCK_SOURCES)[number];
export type SheetSection = (typeof SHEET_SECTIONS)[number];

/**
 * A block read out of `characters.db` that the schema refuses degrades to `unknown`
 * rather than failing the whole page list — a hand edit, or a kind a newer build wrote
 * before a rollback. It parses against the full schema first, so a block already
 * wrapped this way on an earlier read passes through rather than being wrapped again.
 * The API's read path calls this at the boundary; a write still goes through
 * `pageBlockSchema` directly, refused the same as before.
 */
export function degradePageBlock(raw: unknown): PageBlock {
  const parsed = pageBlockSchema.safeParse(raw);
  return parsed.success ? parsed.data : { kind: "unknown", raw };
}

/** What a URL carries, so it survives a reorder and a retitle and needs no escaping. */
const pageSlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
  error: "a slug is lowercase letters and digits, joined by single hyphens",
});

const characterPageSchema = z.strictObject({
  slug: pageSlugSchema,
  title: z.string().trim().min(1),
  hidden: z.boolean().default(false),
  blocks: z.array(pageBlockSchema),
});

/** A character's pages in display order: the list a write replaces whole. */
export const characterPagesSchema = z
  .array(characterPageSchema)
  .refine((pages) => isUnique(pages, (page) => page.slug), {
    error: "the same slug is listed twice",
  });

/**
 * A stored page, as an endpoint returns it. The server sets `preset` and never accepts
 * it: a preset can be hidden or edited but not deleted, and restoring the defaults
 * resets the presets alone.
 */
export const characterPageRecordSchema = characterPageSchema.extend({ preset: z.boolean() });

export type CharacterPage = z.infer<typeof characterPageSchema>;
export type CharacterPageRecord = z.infer<typeof characterPageRecordSchema>;

/**
 * Seeded on every character, in this order. A preset's blocks are whole sheet sections.
 * A new entry reaches existing characters only through a backfill migration, as these
 * four did. That migration must settle any user page already under the new slug, since
 * restoring the defaults fails on one.
 */
export const PRESET_PAGES: readonly CharacterPage[] = [
  {
    slug: "stats",
    title: "Stats",
    hidden: false,
    blocks: [{ kind: "section", section: "abilities" }],
  },
  {
    slug: "spells",
    title: "Spells",
    hidden: false,
    blocks: [{ kind: "section", section: "spells" }],
  },
  {
    slug: "inventory",
    title: "Inventory",
    hidden: false,
    blocks: [{ kind: "section", section: "inventory" }],
  },
  {
    slug: "features",
    title: "Features",
    hidden: false,
    blocks: [{ kind: "section", section: "features" }],
  },
];

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
  abilityModifiers: z.record(abilitySchema, derivedSchema(z.int())),
  hitPointMaximum: derivedSchema(z.int().min(1)),
  /**
   * Grouped by die size the way `hitDicePoolSchema` groups the pool a rest spends, in the
   * order each die was first taken. `total` is the pool's size; what remains is state.
   */
  hitDice: z.array(
    z.strictObject({ die: z.literal(HIT_DICE), total: derivedSchema(z.int().min(1)) }),
  ),
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
  proficiencyBonus: derivedSchema(z.int().min(2).max(6)),
  /** Every ability, since an unproficient save is still a number the sheet shows. */
  savingThrows: z.record(abilitySchema, derivedSchema(z.int())),
  /**
   * One entry per catalog skill row the caller hands in — every skill of the
   * character's edition, proficient or not, so the sheet has a full list to render
   * rather than only the ones a player picked.
   */
  skills: z.array(
    z.strictObject({
      ref: contentRefSchema,
      modifier: derivedSchema(z.int()),
      passive: derivedSchema(z.int()),
    }),
  ),
  armorClass: derivedSchema(z.int()),
  initiative: derivedSchema(z.int()),
  /**
   * One entry per class that casts, since a multiclassed caster sets a different DC
   * and attack bonus per class rather than one figure for the whole character. Empty
   * for a character with no caster class.
   */
  spellcasting: z.array(
    z.strictObject({
      class: entryRefSchema,
      ability: abilitySchema,
      saveDc: derivedSchema(z.int()),
      attackBonus: derivedSchema(z.int()),
    }),
  ),
});

/**
 * The hit point maximum for a stored character.
 *
 * `hitDice` maps a class to its die, keyed by `entryKey`, the same as `carriedWeight`'s
 * `weights` — a class is catalog or homebrew data a character references rather than
 * copies. A class the map does not name is rejected rather than defaulted, since a
 * guessed die invents hit points.
 */
export function hitPointMaximum(
  definition: CharacterDefinition,
  hitDice: ReadonlyMap<string, HitDie>,
): number {
  const levels = definition.levels.map((level) => {
    const key = entryKey(level.class);
    const die = hitDice.get(key);
    if (die === undefined) throw new RangeError(`No hit die for ${key}`);
    return { die, rolled: level.rolled };
  });
  return maxHitPoints(levels, abilityModifier(definition.abilityScores.con));
}

/**
 * The passive score for one skill: 10, the ability modifier, and whatever the character's
 * proficiency in that skill is worth at this level.
 *
 * `ability` is the `skills` row's own, catalog data a character references rather than
 * copies, the way `hitPointMaximum` takes the hit die. A skill the character lists no
 * entry for scores as unproficient rather than throwing: every skill has a passive score,
 * and only the proficiency is optional.
 */
export function passiveSkill(
  definition: CharacterDefinition,
  skill: ContentRef,
  ability: Ability,
): number {
  const key = refKey(skill);
  const entry = definition.proficiencies.skills.find((held) => refKey(held.ref) === key);
  return passiveScore(
    abilityModifier(definition.abilityScores[ability]),
    proficiencyContribution(totalLevel(definition), entry?.level ?? "none"),
  );
}

export const ABILITY_LABEL: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/**
 * The check modifier for one skill: the ability modifier and whatever the character's
 * proficiency in that skill is worth. Companion to `passiveSkill`, which takes the same
 * inputs to the passive score instead.
 */
export function skillModifier(
  definition: CharacterDefinition,
  skill: ContentRef,
  ability: Ability,
): Breakdown<TermReference> {
  const key = refKey(skill);
  const entry = definition.proficiencies.skills.find((held) => refKey(held.ref) === key);
  const contribution = proficiencyContribution(totalLevel(definition), entry?.level ?? "none");
  const terms: Term<TermReference>[] = [
    {
      label: ABILITY_LABEL[ability],
      value: abilityModifier(definition.abilityScores[ability]),
      reference: skill,
    },
  ];
  if (contribution !== 0) terms.push({ label: "Proficiency", value: contribution });
  return breakdown(terms);
}

/**
 * The saving throw modifier for one ability: its modifier, and proficiency where
 * `proficiencies.savingThrows` names it. Only the character's first class grants a
 * saving throw proficiency in 5e, so that choice is already resolved into this list
 * rather than read again from a class row here.
 */
export function savingThrowModifier(
  definition: CharacterDefinition,
  ability: Ability,
): Breakdown<TermReference> {
  const proficient = definition.proficiencies.savingThrows.includes(ability);
  const contribution = proficiencyContribution(
    totalLevel(definition),
    proficient ? "proficient" : "none",
  );
  const terms: Term<TermReference>[] = [
    { label: ABILITY_LABEL[ability], value: abilityModifier(definition.abilityScores[ability]) },
  ];
  if (contribution !== 0) terms.push({ label: "Proficiency", value: contribution });
  return breakdown(terms);
}

/** One catalog skill row a derived block iterates: its ability, since a character stores none. */
export type SkillTrait = { ref: ContentRef; ability: Ability };

/**
 * What one equipped item contributes to armor class: its own number, and which
 * Dexterity rule it grants. `"shield"` stacks with worn armor rather than replacing it.
 */
export type ArmorTrait = { category: "light" | "medium" | "heavy" | "shield"; armorClass: number };

/**
 * The catalog facts a derived block needs, each already resolved by the caller from
 * `content.db` or homebrew — never a raw 5etools shape, which is a catalog schema's job
 * to parse. Keyed the way the field that reads it already keys a lookup: `hitDice` and
 * `spellcastingAbilities` by `entryKey` of a `levels` entry's class, `armor` by
 * `entryKey` of an inventory entry's reference.
 */
export type CharacterCatalog = {
  hitDice: ReadonlyMap<string, HitDie>;
  /** Absent for a class that grants no spellcasting, such as a Fighter with no casting subclass. */
  spellcastingAbilities: ReadonlyMap<string, Ability>;
  skills: readonly SkillTrait[];
  size: Size;
  speed: Speed;
  armor: ReadonlyMap<string, ArmorTrait>;
};

/** A freshly computed derived field, always with its terms — never read back from storage. */
type ComputedField<T> = { computed: T; manual: null; terms: Term<TermReference>[] };

const DEXTERITY_CAP: Record<Exclude<ArmorTrait["category"], "shield">, number | "none" | "all"> = {
  light: "all",
  medium: 2,
  heavy: "none",
};

/** `undefined` for a homebrew ref: `TermReference` names only a catalog `(name, source)`. */
function catalogReference(ref: EntryRef): ContentRef | undefined {
  return "homebrewId" in ref ? undefined : ref;
}

type WornArmor = {
  category: Exclude<ArmorTrait["category"], "shield">;
  armorClass: number;
  ref: EntryRef;
};
type WornShield = { armorClass: number; ref: EntryRef };

/** The worn armor and the shield a character has equipped, last one of each wins. */
function equippedArmor(
  definition: CharacterDefinition,
  armor: ReadonlyMap<string, ArmorTrait>,
): { worn?: WornArmor; shield?: WornShield } {
  let worn: WornArmor | undefined;
  let shield: WornShield | undefined;
  for (const entry of definition.inventory) {
    if (!entry.equipped) continue;
    const trait = armor.get(entryKey(entry.ref));
    if (trait === undefined) continue;
    if (trait.category === "shield") {
      shield = { armorClass: trait.armorClass, ref: entry.ref };
    } else {
      worn = { category: trait.category, armorClass: trait.armorClass, ref: entry.ref };
    }
  }
  return { worn, shield };
}

/**
 * Armor class from whatever the character has equipped. An item `armor` does not name —
 * the reference no longer resolves, or nothing is equipped — degrades to the unarmored
 * base of 10 rather than throwing, since one missing suit of armor is not a reason to
 * refuse the rest of the sheet.
 *
 * Unarmored Defense, the formula a Barbarian or a Monk uses in place of 10, is not
 * modeled: no catalog field states one yet. The gap closes the day a class's own row
 * carries it; until then this reads the base as if no such feature exists.
 */
function derivedArmorClass(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): ComputedField<number> {
  const { worn, shield } = equippedArmor(definition, catalog.armor);
  const result = armorClass<TermReference>({
    base: worn ? { value: worn.armorClass, reference: catalogReference(worn.ref) } : { value: 10 },
    dexterityModifier: { value: abilityModifier(definition.abilityScores.dex) },
    dexterityCap: worn ? DEXTERITY_CAP[worn.category] : "all",
    shield: shield
      ? { value: shield.armorClass, reference: catalogReference(shield.ref) }
      : undefined,
  });
  return { computed: result.total, manual: null, terms: result.terms };
}

/** A class `hitDice` does not name is rejected the same way `hitPointMaximum` rejects it. */
function hitDicePools(
  definition: CharacterDefinition,
  hitDice: ReadonlyMap<string, HitDie>,
): CharacterDerived["hitDice"] {
  const totals = new Map<HitDie, number>();
  for (const level of definition.levels) {
    const key = entryKey(level.class);
    const die = hitDice.get(key);
    if (die === undefined) throw new RangeError(`No hit die for ${key}`);
    totals.set(die, (totals.get(die) ?? 0) + 1);
  }
  return [...totals].map(([die, total]) => ({
    die,
    total: { computed: total, manual: null, terms: [] },
  }));
}

/** One entry per class that casts, in the order its levels were taken. */
function spellcastingEntries(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  characterLevel: number,
): CharacterDerived["spellcasting"] {
  const seen = new Set<string>();
  const entries: CharacterDerived["spellcasting"] = [];
  for (const level of definition.levels) {
    const key = entryKey(level.class);
    if (seen.has(key)) continue;
    seen.add(key);
    const ability = catalog.spellcastingAbilities.get(key);
    if (ability === undefined) continue;
    const modifier = abilityModifier(definition.abilityScores[ability]);
    entries.push({
      class: level.class,
      ability,
      saveDc: { computed: spellSaveDc(modifier, characterLevel), manual: null, terms: [] },
      attackBonus: {
        computed: spellAttackBonus(modifier, characterLevel),
        manual: null,
        terms: [],
      },
    });
  }
  return entries;
}

/**
 * The whole derived block for one character: every value `characterDerivedSchema`
 * holds, assembled from the definition and the catalog facts the caller resolved for
 * it. `manual` is always null here — an override lives in `field_overrides` and is a
 * later layer's job to fold in, never this one's to invent.
 */
export function deriveCharacter(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): CharacterDerived {
  const level = totalLevel(definition);

  const savingThrows = Object.fromEntries(
    ABILITIES.map((ability) => {
      const { total, terms } = savingThrowModifier(definition, ability);
      return [ability, { computed: total, manual: null, terms }];
    }),
  ) as Record<Ability, ComputedField<number>>;

  const skills = catalog.skills.map((skill) => {
    const { total, terms } = skillModifier(definition, skill.ref, skill.ability);
    return {
      ref: skill.ref,
      modifier: { computed: total, manual: null, terms },
      passive: {
        computed: passiveSkill(definition, skill.ref, skill.ability),
        manual: null,
        terms: [],
      },
    };
  });

  const abilityModifiers = Object.fromEntries(
    ABILITIES.map((ability): [Ability, ComputedField<number>] => [
      ability,
      { computed: abilityModifier(definition.abilityScores[ability]), manual: null, terms: [] },
    ]),
  ) as Record<Ability, ComputedField<number>>;

  return {
    abilityModifiers,
    hitPointMaximum: {
      computed: hitPointMaximum(definition, catalog.hitDice),
      manual: null,
      terms: [],
    },
    hitDice: hitDicePools(definition, catalog.hitDice),
    size: { computed: catalog.size, manual: null, terms: [] },
    speed: { computed: catalog.speed, manual: null, terms: [] },
    proficiencyBonus: { computed: proficiencyBonus(level), manual: null, terms: [] },
    savingThrows,
    skills,
    armorClass: derivedArmorClass(definition, catalog),
    initiative: {
      computed: abilityModifier(definition.abilityScores.dex),
      manual: null,
      terms: [],
    },
    spellcasting: spellcastingEntries(definition, catalog, level),
  };
}

/**
 * Ten-thousandths of a pound, the grid the sum counts on. Upstream prints nothing finer
 * — `Bead of Force` (DMG) at 0.0625 and `Energy Cell` (DMG) at 0.3125 hold the four
 * decimals — so the scale costs no accuracy and buys an exact total across rows of
 * different weights, where adding five kinds of ammunition and a purse of coins as
 * floats lands beside the answer rather than on it. A finer weight rounds to the grid,
 * and the way out is a larger scale, bounded by the 2^53 the integer sum stays inside.
 */
const WEIGHT_SCALE = 10_000;

const scaled = (pounds: number): number => Math.round(pounds * WEIGHT_SCALE);

/**
 * The pounds a character is carrying: every inventory entry flagged `carried`, times its
 * quantity, plus the coins.
 *
 * `weights` maps `entryKey` to an item's weight in pounds, from the catalog and from
 * homebrew, which the caller merges into one map and expands a magic variant into first.
 * A `null` is a row that states no weight and adds nothing; a reference the map does not
 * name is refused, because a silent zero would hide it.
 *
 * Coins count regardless of `carried`, because `money` is a purse the definition has
 * nowhere to put down: a character who banked 1,000 gp in town carries 20 pounds they
 * left there, and `encumbranceAt` reads this total straight. The way out is a flag on
 * `money`, or an inventory entry per denomination.
 */
export function carriedWeight(
  definition: CharacterDefinition,
  weights: ReadonlyMap<string, number | null>,
): number {
  let total = 0;
  for (const entry of definition.inventory) {
    if (!entry.carried) continue;
    const key = entryKey(entry.ref);
    const weight = weights.get(key);
    if (weight === undefined) throw new RangeError(`No item row for ${key}`);
    total += scaled(weight ?? 0) * entry.quantity;
  }
  const coins = Object.values(definition.money).reduce((sum, count) => sum + count, 0);
  return (total + scaled(POUNDS_PER_COIN) * coins) / WEIGHT_SCALE;
}

/**
 * The modes a character actually has. A key written as `undefined` survives the parse, so
 * dropping it here keeps it out of the arithmetic and out of every reader downstream.
 *
 * A caller casts the rebuilt object back to `Speed`, which holds only while `walk` is
 * required: an optional one would let this return nothing and the cast stay quiet.
 */
function presentModes(speed: Speed): [string, number][] {
  return Object.entries(speed).filter((entry): entry is [string, number] => entry[1] !== undefined);
}

/**
 * What a load costs a character: the speeds they move at now, and the disadvantage heavy
 * encumbrance imposes.
 *
 * Nothing is stored, so turning the option on mid-campaign changes the answer and leaves
 * no stale derived value behind.
 *
 * The variant reads "your speed drops by 10 feet" and names no movement mode, so the
 * reduction comes off every mode the character has rather than walking alone.
 *
 * `weight` is the caller's, from `carriedWeight`. This applies encumbrance alone, and
 * `speedReduction` is how a caller composes another reduction with it.
 */
export function encumberedSpeed(
  definition: CharacterDefinition,
  derived: CharacterDerived,
  weight: number,
): EncumberedSpeed {
  const modes = presentModes(derivedValue(derived.speed));
  if (!houseRule(definition, "encumbrance")) {
    return {
      speed: Object.fromEntries(modes) as Speed,
      speedReduction: 0,
      disadvantage: false,
      reductionBreakdown: breakdown([]),
    };
  }
  const { speedReduction, disadvantage } = encumbranceAt(
    definition.abilityScores.str,
    derivedValue(derived.size),
    weight,
  );
  const reduced = Object.fromEntries(
    modes.map(([mode, base]) => [mode, reducedSpeed({ base, reduction: speedReduction })]),
  ) as Speed;
  const reductionTerms: Term<TermReference>[] =
    speedReduction === 0
      ? []
      : [
          {
            label: "Encumbrance",
            value: speedReduction,
            reference: { houseRuleOption: "encumbrance" },
          },
        ];
  return {
    speed: reduced,
    speedReduction,
    disadvantage,
    reductionBreakdown: breakdown(reductionTerms),
  };
}

export type EntryRef = z.infer<typeof entryRefSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type ContentRef = z.infer<typeof contentRefSchema>;
export type CharacterDefinition = z.infer<typeof characterDefinitionSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
export type CharacterDerived = z.infer<typeof characterDerivedSchema>;
export type Speed = z.infer<typeof speedSchema>;

/** A character's speeds under the encumbrance variant, and what else the load costs. */
export type EncumberedSpeed = {
  speed: Speed;
  /**
   * The feet `speed` already lost, handed back unapplied so a caller composes another
   * reduction against the derived speeds rather than reducing `speed` twice: sum this
   * into `reducedSpeed`'s `reduction`. 2014 exhaustion states `halved` and `zeroed`
   * instead of feet, so those go to `reducedSpeed` in the same call. Zero where the
   * table never opted in.
   */
  speedReduction: number;
  /** From `encumbranceAt`, which names the rolls the rule covers. */
  disadvantage: boolean;
  /** Why `speedReduction` is what it is — the encumbrance house rule, or no term at all. */
  reductionBreakdown: Breakdown<TermReference>;
};
