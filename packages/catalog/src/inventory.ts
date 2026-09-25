import { z } from "zod";
import { entriesSchema } from "./entry.ts";

const contentRef = z.strictObject({ name: z.string().min(1), source: z.string().min(1) });

/**
 * `source` is absent on a homebrew item, the same shape difference `SheetSpell` draws.
 * `variant` is the magic variant an unresolved entry named, so the sheet can say what went
 * missing; a resolved one already carries the expanded name.
 */
const sheetItemFields = {
  name: z.string().min(1),
  source: z.string().min(1).optional(),
  quantity: z.int().min(1),
  carried: z.boolean(),
  equipped: z.boolean(),
  attuned: z.boolean(),
};

const sheetItemSchema = z.discriminatedUnion("resolved", [
  z.strictObject({
    resolved: z.literal(true),
    ...sheetItemFields,
    rarity: z.string().min(1).nullable(),
    requiresAttunement: z.boolean(),
    /** Pounds for one, null for an item that states none. */
    weight: z.number().min(0).nullable(),
    entries: entriesSchema,
  }),
  z.strictObject({
    resolved: z.literal(false),
    ...sheetItemFields,
    variant: contentRef.optional(),
  }),
]);

/**
 * A character's inventory in the order the definition lists it, each entry resolved
 * against its catalog or homebrew row and a magic variant expanded against its base item.
 * A reference nothing answers keeps its stored name, marked unresolved.
 *
 * A projection of a character rather than a catalog row, it lives here for the reason
 * `features.ts` gives.
 */
export const characterInventorySchema = z.strictObject({ items: z.array(sheetItemSchema) });

export type SheetItem = z.infer<typeof sheetItemSchema>;
export type CharacterInventory = z.infer<typeof characterInventorySchema>;
