/**
 * A class or subclass row's `json`, in the shape `data/class/class-*.json` writes an
 * entry. Models only what a renderer needs to walk — `name`, `source` and `entries` —
 * everything else upstream carries, such as proficiencies and spellcasting ability,
 * passes through unparsed.
 *
 * The grant schemas below are the level-indexed facts `docs/class-tables.md` describes:
 * a resource's printed value, a caster's slots, an optional feature's running count,
 * and the features gained by that level.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

const classEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  entries: entriesSchema.optional(),
});

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

/** A class or subclass feature, scoped to the class or subclass a caller already named. */
export const classFeatureRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  level: z.int().min(1).max(20),
  json: classEntrySchema,
});

export type ClassFeatureRecord = z.infer<typeof classFeatureRecordSchema>;

/** The `hd` roll a class table prints — one die, the shape `hitDie` below derives from. */
const hitDieRollSchema = z.strictObject({ number: z.literal(1), faces: z.int().positive() });

/**
 * A homebrew class's `json`: `classEntrySchema`'s shape plus a required `hd`, since a
 * homebrew class has no `packages/content/src/load/classes.ts` load step to reject a
 * missing or malformed roll first — the schema is the only gate a caller's paste meets
 * before `homebrewClassRecordSchema.hitDie` reads `hd.faces` off it. It carries no
 * feature or subclass rows of its own — see `docs/data-model.md`.
 */
export const homebrewClassSchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  hd: hitDieRollSchema,
  entries: entriesSchema.optional(),
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
