import { ABILITIES } from "@dnd/rules";
import { z } from "zod";

const scores = (max: number) =>
  z.partialRecord(z.enum(ABILITIES), z.int().min(0).max(max)).catch({});

/**
 * What an item row does to ability scores: a `static` score that replaces the wearer's
 * where it is higher, and a `bonus` that adds to it, stopping at `max` where the item
 * states one. A potion's grant lasts as long as the drink, so a potion grants nothing, as
 * in `defenseTraitSchema`. A `choose` or `from` entry names a pick the character stores
 * nowhere yet, so it grants nothing; a malformed field degrades to none rather than
 * refusing the row.
 */
export const abilityGrantSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    ability: z
      .looseObject({
        static: scores(30).optional(),
        max: z.int().min(1).max(30).optional().catch(undefined),
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
    const grant = {
      static: ability?.static ?? {},
      bonus,
      ...(ability?.max !== undefined && { max: ability.max }),
    };
    const empty = Object.keys(grant.static).length + Object.keys(bonus).length === 0;
    return empty || type?.split("|")[0] === "P" ? undefined : grant;
  });
