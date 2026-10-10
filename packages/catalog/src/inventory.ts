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

/**
 * `abbreviation` is upstream's `type` code with its source suffix dropped — `M` for
 * `M|XPHB` — and `name` its label from the `itemType` lookups, null where none matches.
 */
const itemTypeSchema = z.strictObject({
  abbreviation: z.string().min(1),
  name: z.string().min(1).nullable(),
});

const weaponFactsSchema = z.strictObject({
  category: z.enum(["simple", "martial"]).nullable(),
  damage: z
    .strictObject({ dice: z.string().min(1), type: z.string().min(1).nullable() })
    .nullable(),
});

/** `armorClass` is the printed AC with the item's own `bonusAc`; a shield's is what it adds. */
const armorFactsSchema = z.strictObject({
  category: z.enum(["light", "medium", "heavy", "shield"]),
  armorClass: z.int(),
});

/** A price the item does not state, read from the rarity table `table` names. */
const valueEstimateSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("amount"),
    table: z.string().min(1),
    copper: z.number().min(0),
  }),
  z.strictObject({
    kind: z.literal("range"),
    table: z.string().min(1),
    min: z.number().min(0),
    max: z.number().min(0).nullable(),
  }),
  z.strictObject({ kind: z.literal("priceless"), table: z.string().min(1) }),
]);

const sheetItemSchema = z.discriminatedUnion("resolved", [
  z.strictObject({
    resolved: z.literal(true),
    ...sheetItemFields,
    type: itemTypeSchema.nullable(),
    rarity: z.string().min(1).nullable(),
    requiresAttunement: z.boolean(),
    /** Pounds for one, null for an item that states none. */
    weight: z.number().min(0).nullable(),
    /** Copper pieces for one, null for an item that states no price. */
    value: z.number().min(0).nullable(),
    /** Null where `value` is printed or no table prices the item, so a total never sums it. */
    estimate: valueEstimateSchema.nullable(),
    weapon: weaponFactsSchema.nullable(),
    armor: armorFactsSchema.nullable(),
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
