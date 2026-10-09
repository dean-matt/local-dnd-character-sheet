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

/**
 * A class or subclass feature, keyed as its row is in `docs/data-model.md`: `Bear` (PHB)
 * is three rows of the Totem Warrior, at levels 3, 6 and 14. `subclass` carries the short
 * name a feature row keys on — `Totem Warrior`, not the `Path of the Totem Warrior` a
 * level stores.
 */
export const featureKeySchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  className: z.string().min(1),
  classSource: z.string().min(1),
  subclass: z.strictObject({ shortName: z.string().min(1), source: z.string().min(1) }).optional(),
  level: z.int().min(1).max(20),
});

/** A union needs strictness doubly: open branches would each strip the keys of the other. */
export const entryRefSchema = z.union([contentRefSchema, homebrewRefSchema]);

export type EntryRef = z.infer<typeof entryRefSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type ContentRef = z.infer<typeof contentRefSchema>;
export type DeityRef = z.infer<typeof deityRefSchema>;
export type FeatureKey = z.infer<typeof featureKeySchema>;
