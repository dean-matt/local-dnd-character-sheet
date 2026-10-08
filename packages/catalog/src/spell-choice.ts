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

/** The spells one grantor gives outright by a level, and never one it leaves to a pick. */
export const grantedSpellsSchema = z.strictObject({ spells: z.array(catalogRefSchema) });

/** Past this a request is refused, a bound on one character rather than a count any reaches. */
const MAX_SPELLS_PER_LOOKUP = 500;

/**
 * Spells to look up, and the class whose list each is checked against. A subclass widens
 * the list by the spells it adds to it, as the Eldritch Knight's are the wizard's.
 */
export const spellLookupRequestSchema = z.strictObject({
  spells: z.array(spellRefSchema).max(MAX_SPELLS_PER_LOOKUP),
  list: z
    .strictObject({ class: catalogRefSchema, subclass: catalogRefSchema.optional() })
    .optional(),
});

export type SpellLookupRequest = z.infer<typeof spellLookupRequestSchema>;

/**
 * Positional: each spell's level and whether the list holds it, `null` where no row
 * answers. `listed` is absent where the request named no list, and false for a homebrew
 * spell, which no class list holds.
 */
export const spellLookupResponseSchema = z.strictObject({
  spells: z.array(
    z.strictObject({ level: z.int().min(0).max(9), listed: z.boolean().optional() }).nullable(),
  ),
});

export type SpellLookup = z.infer<typeof spellLookupResponseSchema>["spells"][number];
