import { z } from "zod";

/** `+1`, as upstream writes a magic item's bonus. Anything else adds nothing rather than refusing the row. */
const signed = z
  .string()
  .regex(/^[+-]\d+$/)
  .transform(Number)
  .optional()
  .catch(undefined);

const ARMOR_CODES = new Set(["LA", "MA", "HA", "S"]);

/**
 * What a worn item adds to armor class and saving throws. `ac` is `bonusAc` on an item
 * that is not armor or a shield: armor's own `bonusAc` already sits in `armorTraitSchema`'s
 * number, so reading it here would count it twice. `save` is `bonusSavingThrow`, added to
 * every save, and `concentration` is `bonusSavingThrowConcentration`, added to concentration
 * saves alone. A potion's bonus lasts as long as the drink, so a potion grants nothing, as
 * in `defenseTraitSchema`. `undefined` for a row that adds none.
 */
export const itemBonusSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    bonusAc: signed,
    bonusSavingThrow: signed,
    bonusSavingThrowConcentration: signed,
  })
  .transform(({ type, bonusAc, bonusSavingThrow, bonusSavingThrowConcentration }) => {
    const code = type?.split("|")[0] ?? "";
    const bonus = {
      ac: ARMOR_CODES.has(code) ? 0 : (bonusAc ?? 0),
      save: bonusSavingThrow ?? 0,
      concentration: bonusSavingThrowConcentration ?? 0,
    };
    const none = bonus.ac === 0 && bonus.save === 0 && bonus.concentration === 0;
    return none || code === "P" ? undefined : bonus;
  });
