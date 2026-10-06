import { GRIPS, HIT_DICE, PROFICIENCY_LEVELS, SIZES } from "@dnd/rules";
import { z } from "zod";
import { houseRulesSchema } from "./houseRules.ts";
import { entryKey, isUnique, refKey } from "./keys.ts";
import {
  abilitySchema,
  contentRefSchema,
  deityRefSchema,
  editionSchema,
  entryRefSchema,
} from "./refs.ts";

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

const SCORE_RANGE = "A score is a whole number from 1 to 30.";

/** Exhaustive: a record keyed by an enum requires every ability to be present. */
export const abilityScoresSchema = z.record(
  abilitySchema,
  z.int({ error: SCORE_RANGE }).min(1, { error: SCORE_RANGE }).max(30, { error: SCORE_RANGE }),
);

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
 * `grip` is how a versatile weapon is held, and absent reads as one-handed. The stored grip
 * survives a shield going on, so it comes back once the shield comes off.
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
    grip: z.enum(GRIPS).optional(),
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
 * A value the character holds against the rules as printed, and why, noted where the
 * player took a path the rules do not offer. `field` is the value's path through the
 * definition — `abilityScores.str`, `race` — so a sheet can mark the value it names.
 * The schema never judges legality; a departure records one rather than refusing it.
 */
const departureSchema = z.strictObject({
  field: z.string().min(1),
  note: z.string().min(1),
});

export const characterDefinitionSchema = z.strictObject({
  name: z.string().min(1, { error: "A character needs a name." }),
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
  /**
   * The size the player picked where the race offers more than one, such as Small or
   * Medium for `Human` (XPHB). Where it is absent or names a size the race does not
   * offer, the derived block takes the race's largest, so a race change leaves no stale
   * size behind.
   */
  size: z.enum(SIZES).optional(),
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
  departures: z.array(departureSchema).default([]),
  /**
   * What the user typed over a derived field, keyed by the field's path through the
   * derived block — `armorClass`, `abilityModifiers.dex`, `skills.Stealth|XPHB.modifier`
   * — for `deriveCharacter` to fold into its `manual`. Sparse: an absent key is no
   * override, and deleting one restores the computed value.
   */
  overrides: z.record(z.string().min(1), z.unknown()).default({}),
});

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

export type CharacterDefinition = z.infer<typeof characterDefinitionSchema>;
