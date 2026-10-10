import { z } from "zod";

/** `+1`, as upstream writes a magic item's bonus. Anything else adds nothing rather than refusing the row. */
const signed = z
  .string()
  .regex(/^[+-]\d+$/)
  .transform(Number)
  .optional()
  .catch(undefined);

const MODES = z.enum(["walk", "burrow", "climb", "fly", "swim"]);

/**
 * `modifySpeed` as upstream writes it: `static` sets a mode, `equal` makes one mode match
 * another, `multiply` scales a mode and `bonus` adds feet, to one mode or to all of them
 * under `*`. A malformed field changes no speed rather than refusing the row.
 */
const speedModifierSchema = z
  .object({
    static: z.partialRecord(MODES, z.int()).optional(),
    equal: z.partialRecord(MODES, MODES).optional(),
    multiply: z.partialRecord(MODES, z.number().positive()).optional(),
    bonus: z.partialRecord(z.union([MODES, z.literal("*")]), z.int()).optional(),
  })
  .optional()
  .catch(undefined);

const ARMOR_CODES = new Set(["LA", "MA", "HA", "S"]);

/**
 * What a worn item adds to armor class, saving throws, spellcasting and the rest of the
 * sheet. `ac` is `bonusAc` on an item
 * that is not armor or a shield: armor's own `bonusAc` already sits in `armorTraitSchema`'s
 * number, so reading it here would count it twice. `save` is `bonusSavingThrow`, added to
 * every save, and `concentration` is `bonusSavingThrowConcentration`, added to concentration
 * saves alone. `spellAttack`, `spellSaveDc` and `spellDamage` are the three `bonusSpell*` fields.
 * `abilityCheck` is `bonusAbilityCheck`, `proficiencyBonus` is `bonusProficiencyBonus`, and
 * `critThreshold` is the lowest d20 result that scores a critical hit, absent for a row
 * that states none. `grantsProficiency` and `grantsLanguage` are upstream's flags: they
 * state that the item grants one and name none, so the sheet can cite the item and no more.
 * A potion's bonus lasts as long as the drink, so a potion grants nothing, as in
 * `defenseTraitSchema`. `undefined` for a row that adds none.
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
    bonusAbilityCheck: signed,
    bonusProficiencyBonus: signed,
    critThreshold: z.int().min(2).max(19).optional().catch(undefined),
    modifySpeed: speedModifierSchema,
    grantsProficiency: z.literal(true).optional().catch(undefined),
    grantsLanguage: z.literal(true).optional().catch(undefined),
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
      abilityCheck: row.bonusAbilityCheck ?? 0,
      proficiencyBonus: row.bonusProficiencyBonus ?? 0,
      grantsProficiency: row.grantsProficiency === true,
      grantsLanguage: row.grantsLanguage === true,
      ...(row.critThreshold && { critThreshold: row.critThreshold }),
      ...(row.modifySpeed && { speed: row.modifySpeed }),
    };
    const none = Object.values(bonus).every((value) => value === 0 || value === false);
    return none || code === "P" ? undefined : bonus;
  });
