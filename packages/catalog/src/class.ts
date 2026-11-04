/**
 * A class or subclass row's `json`, in the shape `data/class/class-*.json` writes an
 * entry. Models only what a renderer needs to walk — `name`, `source` and `entries` —
 * everything else upstream carries, such as proficiencies, passes through unparsed.
 * `spellcastingAbilitySchema` reads the casting ability off the same entry.
 *
 * The grant schemas below are the level-indexed facts `docs/class-tables.md` describes:
 * a resource's printed value, a caster's slots, an optional feature's running count,
 * and the features gained by that level.
 */
import { ABILITIES, CASTER_PROGRESSIONS, EDITIONS, type PreparationRule } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";
import { HOMEBREW_SOURCE } from "./source.ts";

const classEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  entries: entriesSchema.optional(),
});

/**
 * The ability a class or subclass row casts with, `undefined` where it casts none. A
 * subclass states its own — Eldritch Knight, Arcane Trickster — under a class that does not.
 */
export const spellcastingAbilitySchema = z
  .looseObject({ spellcastingAbility: z.enum(ABILITIES).optional() })
  .transform((entry) => entry.spellcastingAbility);

/**
 * The slot table a class or subclass row casts from, `undefined` where it has none. A
 * third caster states it on the subclass — Eldritch Knight, Arcane Trickster.
 */
export const casterProgressionSchema = z
  .looseObject({ casterProgression: z.enum(CASTER_PROGRESSIONS).optional() })
  .transform((entry) => entry.casterProgression);

/**
 * How a `classic` class counts its prepared list, read off the formula its row prints:
 * `<$level$> + <$wis_mod$>` counts the class level, `<$level$> / 2 + <$cha_mod$>` half
 * of it. `undefined` for a row with no formula — a class that knows its spells, or a
 * `one` class, which prints a Prepared Spells column instead.
 */
export const preparationRuleSchema = z
  .looseObject({ preparedSpells: z.string().optional() })
  .transform((entry): PreparationRule | undefined => {
    const formula = entry.preparedSpells;
    if (formula === undefined || !formula.includes("<$level$>")) return undefined;
    return /<\$level\$>\s*\/\s*2/.test(formula) ? "half-level" : "level";
  });

/**
 * The spells a class copies into its spellbook at each class level, first level first,
 * `undefined` for a class with none. Upstream counts a wizard's under
 * `spellsKnownProgressionFixed`: six at 1st and two at each level after.
 */
export const spellbookGainsSchema = z
  .looseObject({ spellsKnownProgressionFixed: z.array(z.int().nonnegative()).optional() })
  .transform((entry) => entry.spellsKnownProgressionFixed);

/**
 * Whether a class or subclass feature row is one of Tasha's optional class features,
 * which a table opts into rather than a class granting outright.
 */
export const classFeatureVariantSchema = z
  .looseObject({ isClassFeatureVariant: z.boolean().optional() })
  .transform((entry) => entry.isClassFeatureVariant === true);

const spellsByLevelSchema = z.record(z.string(), z.unknown()).optional();

/**
 * The lowest class level at which a row's `additionalSpells` grants a spell, `undefined`
 * where it lists none. Path of the Ancestral Guardian states a casting ability from 3rd
 * level and grants its first spell at 10th. A key that names no class level, such as `_`
 * or `s1`, is skipped.
 */
export const castingStartLevelSchema = z
  .looseObject({
    additionalSpells: z
      .array(
        z.looseObject({
          innate: spellsByLevelSchema,
          known: spellsByLevelSchema,
          prepared: spellsByLevelSchema,
          expanded: spellsByLevelSchema,
        }),
      )
      .optional(),
  })
  .transform((entry) => {
    const levels = (entry.additionalSpells ?? []).flatMap(({ innate, known, prepared, expanded }) =>
      [innate, known, prepared, expanded].flatMap((byLevel) =>
        Object.keys(byLevel ?? {})
          .filter((key) => /^\d+$/.test(key))
          .map(Number),
      ),
    );
    return levels.length === 0 ? undefined : Math.min(...levels);
  });

/**
 * The class level that grants a subclass, read off the first `classFeatures` entry marked
 * `gainSubclassFeature`, `undefined` where none is. It differs by edition as well as by
 * class: `Cleric` (PHB) takes its domain at 1st level, `Cleric` (XPHB) at 3rd. The entry
 * names its feature `name|class|classSource|level`, with an optional feature source after.
 */
export const subclassLevelSchema = z
  .looseObject({ classFeatures: z.array(z.unknown()).optional().catch(undefined) })
  .transform((entry) => {
    const gain = (entry.classFeatures ?? []).find(
      (feature): feature is { classFeature: string } =>
        typeof feature === "object" &&
        feature !== null &&
        "gainSubclassFeature" in feature &&
        feature.gainSubclassFeature === true &&
        "classFeature" in feature &&
        typeof feature.classFeature === "string",
    );
    const level = Number(gain?.classFeature.split("|")[3]);
    return Number.isInteger(level) && level >= 1 && level <= 20 ? level : undefined;
  });

/**
 * How many options of one feature type a homebrew class or subclass knows, in the shape
 * upstream's `optionalfeatureProgression` writes a block: `progression` a count for each of
 * levels 1 to 20, or keyed by the levels the count changes at, as a copied `Sorcerer` (PHB)
 * carries it. `docs/optional-features.md` has both shapes.
 */
/**
 * A level from 1 to 20 as a progression keys it: exactly the 20 spellings, so no two keys reach
 * one level and overwrite it, as `Number` would land "03", " 3" and "1e1" on one.
 */
export const LEVEL_KEY = /^(?:[1-9]|1\d|20)$/;

/**
 * A count at each of levels 1 to 20 from one keyed by the levels it changes at, each count
 * carried forward to the next change: `{"3":2,"10":3}` knows two at level 9, not none.
 */
export function carryForward(changes: Readonly<Record<string, number>>): number[] {
  let held = 0;
  return Array.from({ length: 20 }, (_, at) => {
    held = changes[String(at + 1)] ?? held;
    return held;
  });
}

const progressionSchema = z.union([
  z.array(z.int().min(0)).length(20),
  z.record(z.string().regex(LEVEL_KEY, "A level is 1 to 20"), z.int().min(0)),
]);

const optionalFeatureBlockSchema = z.looseObject({
  name: z.string().optional(),
  featureType: z.array(z.string().min(1)).length(1, "A count names one feature type"),
  progression: progressionSchema,
});

const optionalFeatureProgressionSchema = z
  .array(optionalFeatureBlockSchema)
  .refine(
    (blocks) => new Set(blocks.map(({ featureType }) => featureType[0])).size === blocks.length,
    { message: "Two counts name the same feature type" },
  );

/**
 * A block's `progression` as a count at each of levels 1 to 20, a sparse one carrying its
 * count forward; `undefined` where it is neither shape.
 */
export function knownByLevel(progression: unknown): number[] | undefined {
  const read = progressionSchema.safeParse(progression);
  if (!read.success) return undefined;
  return Array.isArray(read.data) ? read.data : carryForward(read.data);
}

/**
 * The options of each feature type a homebrew class or subclass knows at levels 1 to 20,
 * `known[0]` being level 1. An entry stored in a shape this cannot read counts none.
 */
export const optionalFeatureCountsSchema = z
  .looseObject({
    optionalfeatureProgression: optionalFeatureProgressionSchema.optional().catch(undefined),
  })
  .transform((entry) =>
    (entry.optionalfeatureProgression ?? []).map((block) => ({
      featureType: block.featureType[0] as string,
      known: knownByLevel(block.progression) ?? [],
    })),
  );

/** A class row from `content.db`'s `classes` table, addressed by `(name, source)`. */
export const classRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  hitDie: z.int().positive(),
  json: classEntrySchema,
});

export type ClassRecord = z.infer<typeof classRecordSchema>;

/**
 * A subclass row from `content.db`'s `subclasses` table, addressed by `(name, source,
 * className, classSource)` — see `docs/data-model.md` for why the class rides along.
 */
export const subclassRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  shortName: z.string().min(1),
  className: z.string().min(1),
  classSource: z.string().min(1),
  edition: z.enum(EDITIONS),
  json: classEntrySchema,
});

export type SubclassRecord = z.infer<typeof subclassRecordSchema>;

/**
 * A class or subclass feature, scoped to the class or subclass a caller already named.
 * `choose` marks a feature that offers a choice of the features beside it, such as
 * `Totem Spirit` (PHB), and `offeredBy` names that feature on each option it offers, at
 * the same level.
 */
export const classFeatureRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  level: z.int().min(1).max(20),
  json: classEntrySchema,
  choose: z.int().min(1).optional(),
  offeredBy: z.strictObject({ name: z.string().min(1), source: z.string().min(1) }).optional(),
});

export type ClassFeatureRecord = z.infer<typeof classFeatureRecordSchema>;

/** The `hd` roll a class table prints — one die, the shape `hitDie` below derives from. */
const hitDieRollSchema = z.strictObject({ number: z.literal(1), faces: z.int().positive() });

/**
 * A homebrew class's `json`: `classEntrySchema`'s shape plus a required `hd`, since a
 * homebrew class has no `packages/content/src/load/class-rows.ts` load step to reject a
 * missing or malformed roll first — the schema is the only gate a caller's paste meets
 * before `homebrewClassRecordSchema.hitDie` reads `hd.faces` off it. It carries no
 * feature or subclass rows of its own: features are `homebrewClassFeaturesSchema`, stored
 * beside the class — see `docs/data-model.md`. `subclassLevel` is the class level that grants
 * a subclass, absent where it grants none: a catalog class marks it on a feature row, which
 * a homebrew class has none of. `optionalfeatureProgression` is the option counts
 * `optionalFeatureCountsSchema` reads.
 */
export const homebrewClassSchema = classEntrySchema.extend({
  hd: hitDieRollSchema,
  subclassLevel: z.int().min(1).max(20).optional(),
  optionalfeatureProgression: optionalFeatureProgressionSchema.optional(),
});

export type HomebrewClass = z.infer<typeof homebrewClassSchema>;

/**
 * What a caller submits to create or rename a homebrew class. `source` is never here —
 * the server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the entry
 * rather than inside it, since it is a `homebrew_classes` column, not a field the 5etools
 * shape carries.
 */
export const homebrewClassInputSchema = homebrewClassSchema.omit({ source: true }).extend({
  edition: z.enum(EDITIONS),
});

export type HomebrewClassInput = z.infer<typeof homebrewClassInputSchema>;

/** A stored homebrew class, as an endpoint returns it. */
export const homebrewClassRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  hitDie: z.int().positive(),
  json: homebrewClassSchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewClassRecord = z.infer<typeof homebrewClassRecordSchema>;

/**
 * A homebrew subclass's `json`: the 5etools entry shape `classEntrySchema` models, with the
 * option counts a homebrew class states too. The class it belongs to is a column beside the
 * entry, not a field in it, so renaming a homebrew class cannot leave the entry naming a class
 * that is gone; a read stamps `className`, `classSource` and `shortName` in, the way
 * `subclassRecordSchema`'s rows carry them.
 */
export const homebrewSubclassSchema = classEntrySchema.extend({
  optionalfeatureProgression: optionalFeatureProgressionSchema.optional(),
});

export type HomebrewSubclass = z.infer<typeof homebrewSubclassSchema>;

/**
 * The class a homebrew subclass belongs to: a catalog class by `(name, source)`, or a
 * homebrew class by `classId`, which survives that class's rename. A subclass of a
 * catalog class takes that class's edition, a subclass of a homebrew class takes its own.
 */
const homebrewSubclassParentSchema = z.union([
  z.strictObject({
    name: z.string().min(1),
    source: z
      .string()
      .min(1)
      .refine((source) => source.toUpperCase() !== HOMEBREW_SOURCE, {
        message: "Name a homebrew class by classId",
      }),
  }),
  z.strictObject({ classId: z.string().min(1) }),
]);

/** What a caller submits to create or replace a homebrew subclass; `source` is stamped, never sent. */
export const homebrewSubclassInputSchema = homebrewSubclassSchema
  .omit({ source: true })
  .extend({ parent: homebrewSubclassParentSchema });

export type HomebrewSubclassInput = z.infer<typeof homebrewSubclassInputSchema>;

/**
 * Whether two parents name the same class. A catalog class compares exactly, as the stored
 * columns a sheet looks a subclass up by do, so a change of case counts as a move.
 */
export function sameSubclassParent(
  a: HomebrewSubclassInput["parent"],
  b: HomebrewSubclassInput["parent"],
): boolean {
  if ("classId" in a || "classId" in b) {
    return "classId" in a && "classId" in b && a.classId === b.classId;
  }
  return a.name === b.name && a.source === b.source;
}

/** A subclass's parent class as the editor's class picker labels it, such as `Cleric (PHB)`. */
export function subclassParentLabel(record: {
  className: string;
  classSource: string;
  classId?: string | null;
}): string {
  return `${record.className} (${record.classId ? "Homebrew" : record.classSource})`;
}

/**
 * A stored homebrew subclass, as an endpoint returns it. It has an `id` and no top-level
 * `source`, which tells it from `subclassRecordSchema`'s catalog row in a merged list.
 * `classSource` is `HB` and `classId` is set where the class is a homebrew one.
 */
export const homebrewSubclassRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  className: z.string(),
  classSource: z.string(),
  classId: z.string().optional(),
  json: homebrewSubclassSchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewSubclassRecord = z.infer<typeof homebrewSubclassRecordSchema>;

/** One row of a subclass list: a catalog subclass, or a homebrew one told apart by its `id`. */
export const subclassListItemSchema = z.union([subclassRecordSchema, homebrewSubclassRecordSchema]);

/** One feature of a homebrew class or subclass: a name, the level it arrives at and its rules text. */
const homebrewClassFeatureSchema = z.strictObject({
  name: z.string().min(1),
  level: z.int().min(1).max(20),
  entries: entriesSchema,
});

export type HomebrewClassFeature = z.infer<typeof homebrewClassFeatureSchema>;

/**
 * A homebrew class's or subclass's whole feature list as stored; a name is unique within a level, as a
 * `{@classFeature}` tag keys it. Reads parse with this, so a name stored before `|` and `}` were
 * refused still loads.
 */
export const homebrewClassFeaturesSchema = z
  .array(homebrewClassFeatureSchema)
  .refine(
    (features) =>
      new Set(features.map(({ name, level }) => `${level}|${name.toLowerCase()}`)).size ===
      features.length,
    { message: "Two features share a name and level" },
  );

/** A feature list a writer submits: a `|` or `}` in a name would split or end the `{@classFeature}` tag that links it. */
export const homebrewClassFeaturesInputSchema = homebrewClassFeaturesSchema.superRefine(
  (features, context) => {
    features.forEach(({ name }, index) => {
      const breaker = /[|}]/.exec(name)?.[0];
      if (breaker) {
        context.addIssue({
          code: "custom",
          path: [index, "name"],
          message: `Feature "${name}" cannot contain "${breaker}"`,
        });
      }
    });
  },
);

/** When a homebrew resource refreshes; a table that sets none reads as unspecified, not as `none`. */
const homebrewResourceResetsSchema = z.enum(["short-rest", "long-rest", "none"]);

/**
 * One resource of a homebrew class: its maximum at each of levels 1 to 20, `maximums[0]` being
 * level 1. A `null` is a level with no value, never the previous level's.
 */
const homebrewClassResourceSchema = z.strictObject({
  name: z.string().min(1),
  resets: homebrewResourceResetsSchema.optional(),
  maximums: z.array(z.int().min(0).nullable()).length(20),
});

export type HomebrewClassResource = z.infer<typeof homebrewClassResourceSchema>;

/** A homebrew class's whole set of resource tables; a name is unique within the class, ignoring case. */
export const homebrewClassResourcesSchema = z
  .array(homebrewClassResourceSchema)
  .refine(
    (tables) => new Set(tables.map(({ name }) => name.toLowerCase())).size === tables.length,
    { message: "Two resources share a name" },
  );

/** A homebrew class as its detail endpoint returns it: the record and its resource tables. */
export const homebrewClassDetailSchema = homebrewClassRecordSchema.extend({
  resources: homebrewClassResourcesSchema,
});

/** A printed table value at one level — a count, a die, a bonus — stored as text. */
const classResourceSchema = z.strictObject({
  resourceKey: z.string().min(1),
  value: z.string().min(1),
});

const classSpellSlotSchema = z.strictObject({
  slotLevel: z.int().min(1).max(9),
  slots: z.int().min(1),
});

/** How many options of a feature type a class or subclass knows by this level. */
const classOptionalFeatureCountSchema = z.strictObject({
  featureType: z.string().min(1),
  known: z.int().min(1),
});

/**
 * What a class or subclass grants by one level, assembled: the resources and slots
 * printed at that level, the options it knows by then, and every feature gained up to
 * and including it. A level with no row in a table means the class grants nothing there
 * — an empty array, not a missing key.
 */
export const classGrantsSchema = z.strictObject({
  level: z.int().min(1).max(20),
  resources: z.array(classResourceSchema),
  spellSlots: z.array(classSpellSlotSchema),
  optionalFeatures: z.array(classOptionalFeatureCountSchema),
  features: z.array(classFeatureRecordSchema),
});

export type ClassGrants = z.infer<typeof classGrantsSchema>;

/**
 * The `one`-edition Prepared Spells column at a level: the printed count where the
 * class carries it, distinct from a class that never does — `classic`'s equivalent is
 * `preparedSpellCount` in `@dnd/rules`, arithmetic rather than a printed column.
 */
export const preparedSpellCountSchema = z.discriminatedUnion("prepares", [
  z.strictObject({ prepares: z.literal(true), count: z.int().min(0) }),
  z.strictObject({ prepares: z.literal(false) }),
]);

export type PreparedSpellCount = z.infer<typeof preparedSpellCountSchema>;
