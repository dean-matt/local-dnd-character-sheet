import { ABILITIES, EDITIONS } from "@dnd/rules";
import { z } from "zod";

export const editionSchema = z.enum(EDITIONS);

export const abilitySchema = z.enum(ABILITIES);

export const contentRefSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
});

const homebrewRefSchema = z.strictObject({ homebrewId: z.string().min(1) });

/**
 * A deity, keyed by its pantheon as well as `(name, source)`. Five `PHB` gods —
 * `Oghma`, `Silvanus`, `Surtur`, `Thrym` and `Tyr` — are each written twice under
 * different pantheons, so the pair alone names two rows.
 */
export const deityRefSchema = contentRefSchema.extend({ pantheon: z.string().min(1) });

/** A union needs strictness doubly: open branches would each strip the keys of the other. */
export const entryRefSchema = z.union([contentRefSchema, homebrewRefSchema]);

export type EntryRef = z.infer<typeof entryRefSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type ContentRef = z.infer<typeof contentRefSchema>;
export type DeityRef = z.infer<typeof deityRefSchema>;
