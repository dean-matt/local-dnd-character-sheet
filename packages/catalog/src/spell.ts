/**
 * A spell entry's `json`, in the shape `vendor/5etools/data/spells/spells-*.json` writes
 * it. Models the fields `packages/content/src/load/spells.ts` reads off an entry to
 * derive `concentration` and `ritual`; everything else upstream carries — range,
 * components, damage type, and the rest — passes through unparsed. A `content.db` spell
 * row and a homebrew one both carry this shape in their `json` column, so one schema
 * validates either.
 *
 * Passthrough rather than strict: see `item.ts` for why homebrew JSON does not carry the
 * same "an open object loses an edit" risk a character definition does.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

const durationSpanSchema = z.looseObject({
  concentration: z.boolean().optional(),
});

const metaSchema = z.looseObject({
  ritual: z.boolean().optional(),
});

export const spellEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  level: z.int().min(0).max(9),
  school: z.string().min(1),
  duration: z.array(durationSpanSchema).min(1),
  meta: metaSchema.optional(),
  entries: entriesSchema.optional(),
});

export type SpellEntry = z.infer<typeof spellEntrySchema>;

/**
 * What a caller submits to create or rename a homebrew spell. `source` is never here —
 * the server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the entry
 * rather than inside it, since it is a `homebrew_spells` column, not a field the 5etools
 * shape carries.
 */
export const homebrewSpellInputSchema = spellEntrySchema.omit({ source: true }).extend({
  edition: z.enum(EDITIONS),
});

export type HomebrewSpellInput = z.infer<typeof homebrewSpellInputSchema>;

/** A stored homebrew spell, as an endpoint returns it. */
export const homebrewSpellRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  level: z.int().min(0).max(9),
  school: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
  json: spellEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewSpellRecord = z.infer<typeof homebrewSpellRecordSchema>;

/** A spell row from `content.db`'s `spells` table, addressed by `(name, source)`. */
export const spellRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  level: z.int().min(0).max(9),
  school: z.string().min(1),
  concentration: z.boolean(),
  ritual: z.boolean(),
  json: spellEntrySchema,
});

export type SpellRecord = z.infer<typeof spellRecordSchema>;

/** `condition` is a reaction's trigger, and may carry `{@tag}` markup. */
const spellTimeSchema = z.looseObject({
  number: z.number(),
  unit: z.string().min(1),
  condition: z.string().min(1).optional(),
});

const spellRangeSchema = z.looseObject({
  type: z.string().min(1),
  distance: z.looseObject({ type: z.string().min(1), amount: z.number().optional() }).optional(),
});

const spellComponentsSchema = z.looseObject({
  v: z.boolean().optional(),
  s: z.boolean().optional(),
  r: z.boolean().optional(),
  m: z.union([z.string(), z.boolean(), z.looseObject({ text: z.string() })]).optional(),
});

const spellDurationSchema = z.looseObject({
  type: z.string().min(1),
  duration: z
    .looseObject({
      type: z.string().min(1),
      amount: z.number().optional(),
      upTo: z.boolean().optional(),
    })
    .optional(),
  concentration: z.boolean().optional(),
  ends: z.array(z.string()).optional(),
});

/**
 * The four facts a caster checks before casting, in upstream's own shapes. Each is
 * optional, since a homebrew spell need not state it, and a value that does not match
 * is dropped rather than failing the whole list.
 */
export const spellCastingFactsSchema = z.strictObject({
  time: z.array(spellTimeSchema).min(1).optional(),
  range: spellRangeSchema.optional(),
  components: spellComponentsSchema.optional(),
  duration: z.array(spellDurationSchema).min(1).optional(),
});

/**
 * `source` is absent on a homebrew spell, which stores an id and no source — the same
 * shape difference that tells a homebrew row from a catalog one everywhere else.
 * `origin` is the class the character learned it through.
 */
const sheetSpellFields = {
  name: z.string().min(1),
  source: z.string().min(1).optional(),
  prepared: z.boolean(),
  origin: z.strictObject({ name: z.string().min(1), source: z.string().min(1) }).optional(),
};

const sheetSpellSchema = z.discriminatedUnion("resolved", [
  z.strictObject({
    resolved: z.literal(true),
    ...sheetSpellFields,
    level: z.int().min(0).max(9),
    school: z.string().min(1),
    concentration: z.boolean(),
    ritual: z.boolean(),
    ...spellCastingFactsSchema.shape,
    entries: entriesSchema,
  }),
  z.strictObject({ resolved: z.literal(false), ...sheetSpellFields }),
]);

/**
 * A character's spells in the order the definition lists them, each resolved against
 * its catalog or homebrew row. A reference nothing answers keeps its stored name,
 * marked unresolved, so the sheet shows what went missing rather than dropping it.
 *
 * A projection of a character rather than a catalog row, it lives here for the reason
 * `features.ts` gives.
 */
export const characterSpellsSchema = z.strictObject({ spells: z.array(sheetSpellSchema) });

export type SheetSpell = z.infer<typeof sheetSpellSchema>;
export type CharacterSpells = z.infer<typeof characterSpellsSchema>;
