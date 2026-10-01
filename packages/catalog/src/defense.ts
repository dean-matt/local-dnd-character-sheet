import { z } from "zod";

/**
 * One list of damage types or conditions, lowercased. A `{choose: {from}}` element names a
 * pick the character stores nowhere, so it grants nothing: `Dragonborn` (PHB) resists
 * nothing here, and its color versions, such as `Dragonborn (Black)`, state theirs. A
 * subrace's `null` clears what its race granted, as `Draconblood` (EGW) does. A malformed
 * list grants nothing rather than refusing the row.
 */
const namesSchema = z
  .array(z.unknown())
  .nullable()
  .optional()
  .catch(undefined)
  .transform((list) => [
    ...new Set(
      (list ?? []).flatMap((name) =>
        typeof name === "string" && name.trim() ? [name.trim().toLowerCase()] : [],
      ),
    ),
  ]);

/**
 * What a race, subrace or item row grants against damage and conditions. A potion's
 * grant lasts as long as the drink, so a potion row grants nothing here, however it is
 * flagged in an inventory. Other temporary grants carry no type to fence them by — a balm
 * such as `Muroosa Balm` (EGW), and a deck whose `resist` lists every card's outcome, such
 * as `Deck of Wonder` (BMT) — so those grant while equipped. The way out is an item list
 * that names them.
 */
export const defenseTraitSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    resist: namesSchema,
    immune: namesSchema,
    conditionImmune: namesSchema,
  })
  .transform(({ type, resist, immune, conditionImmune }) =>
    type?.split("|")[0] === "P"
      ? { resist: [], immune: [], conditionImmune: [] }
      : { resist, immune, conditionImmune },
  );
