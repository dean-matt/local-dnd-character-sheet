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
 * What a worn item adds to armor class, saving throws and spellcasting. `ac` is `bonusAc` on an item
 * that is not armor or a shield: armor's own `bonusAc` already sits in `armorTraitSchema`'s
 * number, so reading it here would count it twice. `save` is `bonusSavingThrow`, added to
 * every save, and `concentration` is `bonusSavingThrowConcentration`, added to concentration
 * saves alone. `spellAttack`, `spellSaveDc` and `spellDamage` are the three `bonusSpell*` fields. A potion's bonus lasts as long as the drink, so a potion grants nothing, as
 * in `defenseTraitSchema`. `undefined` for a row that adds none.
 */
export const itemBonusSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    bonusAc: signed,
    bonusSavingThrow: signed,
    bonusSavingThrowConcentration: signed,
    bonusSpellAttack: signed,
    bonusSpellSaveDc: signed,
    bonusSpellDamage: signed,
  })
  .transform((row) => {
    const code = row.type?.split("|")[0] ?? "";
    const bonus = {
      ac: ARMOR_CODES.has(code) ? 0 : (row.bonusAc ?? 0),
      save: row.bonusSavingThrow ?? 0,
      concentration: row.bonusSavingThrowConcentration ?? 0,
      spellAttack: row.bonusSpellAttack ?? 0,
      spellSaveDc: row.bonusSpellSaveDc ?? 0,
      spellDamage: row.bonusSpellDamage ?? 0,
    };
    const none = Object.values(bonus).every((value) => value === 0);
    return none || code === "P" ? undefined : bonus;
  });
