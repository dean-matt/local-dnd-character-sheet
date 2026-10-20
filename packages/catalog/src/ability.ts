import { ABILITIES } from "@dnd/rules";
import { z } from "zod";

const scores = (max: number) =>
  z.partialRecord(z.enum(ABILITIES), z.int().min(0).max(max)).catch({});

/** A pick an item offers: `count` distinct scores from `from`, each raised by `amount`. */
const pickSchema = z.object({
  from: z.array(z.enum(ABILITIES)).min(1),
  count: z.int().min(1).catch(1).default(1),
  amount: z.int().min(1).catch(1).default(1),
});

/**
 * What an item row does to ability scores: a `static` score that replaces the wearer's
 * where it is higher, and a `bonus` that adds to it, stopping at `max` where the item
 * states one. A potion's grant lasts as long as the drink, so a potion grants nothing, as
 * in `defenseTraitSchema`. A `choose` entry, or the bare `from` form the Deck of Many Things
 * writes, is a pick the character stores on the inventory entry; `choose` here carries it.
 * Only the first `choose` group is read, as no row at the pinned tag has two. A malformed
 * field degrades to none rather than refusing the row.
 */
export const abilityGrantSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    ability: z
      .looseObject({
        static: scores(30).optional(),
        max: z.int().min(1).max(30).optional().catch(undefined),
        choose: z.array(z.unknown()).optional().catch(undefined),
        from: z.unknown().optional(),
        count: z.unknown().optional(),
        amount: z.unknown().optional(),
        ...Object.fromEntries(
          ABILITIES.map((ability) => [ability, z.int().optional().catch(undefined)]),
        ),
      })
      .optional()
      .catch(undefined),
  })
  .transform(({ type, ability }) => {
    const bonus: Partial<Record<(typeof ABILITIES)[number], number>> = {};
    for (const key of ABILITIES) {
      const value = ability?.[key];
      if (typeof value === "number" && value !== 0) bonus[key] = value;
    }
    const choose = pickSchema.safeParse(ability?.choose?.[0] ?? ability).data;
    const grant = {
      static: ability?.static ?? {},
      bonus,
      ...(ability?.max !== undefined && { max: ability.max }),
      ...(choose && { choose }),
    };
    const empty =
      Object.keys(grant.static).length + Object.keys(bonus).length === 0 && choose === undefined;
    return empty || type?.split("|")[0] === "P" ? undefined : grant;
  });
