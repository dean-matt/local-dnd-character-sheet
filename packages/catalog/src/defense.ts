import { z } from "zod";

const lowercased = (names: readonly unknown[]) => [
  ...new Set(
    names.flatMap((name) =>
      typeof name === "string" && name.trim() ? [name.trim().toLowerCase()] : [],
    ),
  ),
];

/**
 * One list of damage types or conditions, lowercased. A subrace's `null` clears what its
 * race granted, as `Draconblood` (EGW) does. A malformed list grants nothing rather than
 * refusing the row.
 */
const listSchema = z.array(z.unknown()).nullable().optional().catch(undefined);

const choiceSchema = z.looseObject({
  choose: z.looseObject({ from: z.array(z.unknown()) }),
});

/**
 * What a race, subrace or item row grants against damage and conditions. A potion's
 * grant lasts as long as the drink, so a potion row grants nothing here, however it is
 * flagged in an inventory. Other temporary grants carry no type to fence them by — a balm
 * such as `Muroosa Balm` (EGW), and a deck whose `resist` lists every card's outcome, such
 * as `Deck of Wonder` (BMT) — so those grant while equipped. The way out is an item list
 * that names them.
 *
 * A `{choose: {from}}` element in `resist` grants nothing by itself: `resistChoice` holds
 * what it offers, and the character's pick grants one, as for `Dragonborn` (PHB).
 */
export const defenseTraitSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    resist: listSchema,
    immune: listSchema,
    conditionImmune: listSchema,
  })
  .transform(({ type, resist, immune, conditionImmune }) =>
    type?.split("|")[0] === "P"
      ? { resist: [], resistChoice: [], immune: [], conditionImmune: [] }
      : {
          resist: lowercased(resist ?? []),
          resistChoice: lowercased(
            (resist ?? []).flatMap(
              (element) => choiceSchema.safeParse(element).data?.choose.from ?? [],
            ),
          ),
          immune: lowercased(immune ?? []),
          conditionImmune: lowercased(conditionImmune ?? []),
        },
  );
