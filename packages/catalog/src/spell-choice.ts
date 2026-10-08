/**
 * What a character choosing spells reads beside the picker: the spells a grantor gives
 * outright by a level, and the level and list standing of each spell already picked.
 */
import { z } from "zod";

const catalogRefSchema = z.strictObject({ name: z.string().min(1), source: z.string().min(1) });

const spellRefSchema = z.union([
  catalogRefSchema,
  z.strictObject({ homebrewId: z.string().min(1) }),
]);

/** Each kind of row that can grant a spell, as `GET /spells/granted` names it. */
export const SPELL_GRANTORS = [
  "class",
  "subclass",
  "race",
  "subrace",
  "background",
  "feat",
  "optionalFeature",
] as const;

export type SpellGrantor = (typeof SPELL_GRANTORS)[number];

/**
 * The spells one grantor gives outright by a level, never one it leaves to a pick, and
 * whether it offers any pick by that level.
 */
export const grantedSpellsSchema = z.strictObject({
  spells: z.array(catalogRefSchema),
  offersPicks: z.boolean(),
});

/** Past this a request is refused, a bound on one character rather than a count any reaches. */
const MAX_SPELLS_PER_LOOKUP = 500;

/** A row that can grant a spell, keyed as `GET /spells/granted` names it. */
const spellGrantorSchema = z.strictObject({
  grantor: z.enum(SPELL_GRANTORS),
  ref: catalogRefSchema,
  /** A subclass's class or a subrace's race. */
  parent: catalogRefSchema.optional(),
});

/** Past this a request is refused, more rows than one character names. */
const MAX_GRANTORS_PER_LOOKUP = 50;

/**
 * Spells to look up, the class whose list each is checked against, and the other rows
 * whose own picks each may be. A subclass widens the list by the spells it adds to it, as
 * the Eldritch Knight's are the wizard's.
 */
export const spellLookupRequestSchema = z.strictObject({
  spells: z.array(spellRefSchema).max(MAX_SPELLS_PER_LOOKUP),
  list: z
    .strictObject({ class: catalogRefSchema, subclass: catalogRefSchema.optional() })
    .optional(),
  offeredBy: z.array(spellGrantorSchema).max(MAX_GRANTORS_PER_LOOKUP).optional(),
});

export type SpellLookupRequest = z.infer<typeof spellLookupRequestSchema>;

/**
 * Positional: each spell's name, level, whether the list holds it, and whether a row in
 * `offeredBy` offers it as a pick, `null` where no row answers. `listed` and `offered` are
 * absent where the request named no list or no rows, and false for a homebrew spell, which
 * no catalog row offers.
 */
export const spellLookupResponseSchema = z.strictObject({
  spells: z.array(
    z
      .strictObject({
        name: z.string().min(1),
        level: z.int().min(0).max(9),
        listed: z.boolean().optional(),
        offered: z.boolean().optional(),
      })
      .nullable(),
  ),
});

export type SpellLookup = z.infer<typeof spellLookupResponseSchema>["spells"][number];
