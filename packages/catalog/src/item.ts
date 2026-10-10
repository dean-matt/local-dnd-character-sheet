/**
 * An item row's `json`, in the shape `vendor/5etools/data/items.json` writes it. Models
 * the fields the content loader (`packages/content/src/load/items.ts`) and a renderer
 * read off an entry; everything else upstream carries — weight, value, damage dice, and
 * every field specific to one item `type` — passes through unparsed. `armorTraitSchema`
 * and `weaponTraitSchema` read armor class, damage and attack off the same entry.
 *
 * Passthrough rather than strict, departing from the schemas in `packages/character`:
 * a character definition is read, edited field by field and written back whole, so an
 * open object silently drops an edit on save. The homebrew editor holds the entry it was
 * given rather than a parsed copy, and writes every field it shows no control for back as
 * it found it, bar a weapon's or armor's own on a type change — `packages/character` itself only ever *references* a homebrew row by id —
 * so the risk strict guards against does not apply, and it would
 * instead reject an item pasted straight out of a 5etools-shaped source for carrying a
 * field this schema has not modeled yet.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";
import { itemAdvantageSchema } from "./item-advantage.ts";

/**
 * `true`, a condition such as `"by a spellcaster"`, or `"optional"` — the shape
 * `packages/content/src/load/items.ts`'s `requiresAttunement` already reads.
 */
const reqAttuneSchema = z.union([z.boolean(), z.string().min(1)]);

export const homebrewItemSchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  type: z.string().min(1).optional(),
  rarity: z.string().min(1).optional(),
  reqAttune: reqAttuneSchema.optional(),
  entries: entriesSchema.optional(),
  /** The advantage or disadvantage the item grants its bearer, which a catalog item states in prose. */
  advantage: z.array(itemAdvantageSchema).optional(),
});

export type HomebrewItem = z.infer<typeof homebrewItemSchema>;

/**
 * What a caller submits to create or rename a homebrew item. `source` is never here — the
 * server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the entry rather
 * than inside it, since it is a `homebrew_items` column, not a field the 5etools shape
 * carries.
 */
export const homebrewItemInputSchema = homebrewItemSchema.omit({ source: true }).extend({
  edition: z.enum(EDITIONS),
});

export type HomebrewItemInput = z.infer<typeof homebrewItemInputSchema>;

/** A stored homebrew item, as an endpoint returns it. */
export const homebrewItemRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  type: z.string().nullable(),
  rarity: z.string().nullable(),
  requiresAttunement: z.boolean(),
  json: homebrewItemSchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewItemRecord = z.infer<typeof homebrewItemRecordSchema>;

const ARMOR_CATEGORIES = { LA: "light", MA: "medium", HA: "heavy", S: "shield" } as const;

type ArmorCode = keyof typeof ARMOR_CATEGORIES;

const isArmorCode = (code: string): code is ArmorCode => Object.hasOwn(ARMOR_CATEGORIES, code);

/**
 * What an item row adds to armor class, `undefined` for one that is not armor or a
 * shield or states no `ac`. A 2024 row suffixes its type with a source — `HA|XPHB` — so
 * the code before the bar decides. `bonusAc` is a magic item's own bonus, such as
 * Dwarven Plate's `+2`, and adds to the printed `ac`.
 */
export const armorTraitSchema = z
  .looseObject({
    type: z.string().optional(),
    ac: z.int().optional(),
    bonusAc: z
      .string()
      .regex(/^[+-]\d+$/)
      .optional(),
  })
  .transform(({ type, ac, bonusAc }) => {
    const code = type?.split("|")[0] ?? "";
    if (!isArmorCode(code) || ac === undefined) return undefined;
    return { category: ARMOR_CATEGORIES[code], armorClass: ac + Number(bonusAc ?? 0) };
  });

/** Upstream's one-letter `dmgType` codes, spelled out. */
export const DAMAGE_TYPES: Readonly<Record<string, string>> = {
  A: "acid",
  B: "bludgeoning",
  C: "cold",
  F: "fire",
  I: "poison",
  L: "lightning",
  N: "necrotic",
  O: "force",
  P: "piercing",
  R: "radiant",
  S: "slashing",
  T: "thunder",
  Y: "psychic",
};

/** `+1`, as upstream writes a magic weapon's bonus. Anything else adds nothing rather than refusing the row. */
const signedBonus = z
  .string()
  .regex(/^[+-]\d+$/)
  .transform(Number)
  .optional()
  .catch(undefined);

/** An abbreviation, or `{uid, note}` as `Lance` (XPHB) writes one. */
const weaponPropertySchema = z.union([
  z.string().min(1),
  z.looseObject({ uid: z.string().min(1), note: z.string().optional() }),
]);

/**
 * A weapon's category, printed damage and what an attack with it reads, `undefined` for an
 * item that states neither a category nor a die. `dice` is `dmg1` as printed: a magic
 * weapon's `bonusWeapon` is an attack-time bonus, not part of the die, and lands in
 * `bonus` beside `bonusWeaponAttack` and `bonusWeaponDamage`. A code outside
 * `DAMAGE_TYPES` passes through as written.
 *
 * `baseName` is the weapon a named magic item is built on, `dagger` for `Dagger of Venom`
 * (DMG), so a proficiency in the one weapon covers it. A staff states `staff: true` and no
 * `baseItem` — `Staff of Power` (DMG), and the `Staff` (PHB) focus — and is a quarterstaff.
 *
 * `kind` is ranged for a type code of `R` and melee otherwise, since a staff (`SCF`) and a
 * claw (`OTH`) that state a die are swung. A malformed property list or bonus degrades to
 * none rather than dropping the weapon.
 */
export const weaponTraitSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    baseItem: z.string().min(1).optional().catch(undefined),
    staff: z.boolean().optional().catch(undefined),
    weaponCategory: z.enum(["simple", "martial"]).optional(),
    dmg1: z.string().min(1).optional(),
    dmg2: z.string().min(1).optional().catch(undefined),
    dmgType: z.string().min(1).optional(),
    property: z.array(weaponPropertySchema).optional().catch(undefined),
    bonusWeapon: signedBonus,
    bonusWeaponAttack: signedBonus,
    bonusWeaponDamage: signedBonus,
  })
  .transform((item) => {
    const { weaponCategory, dmg1, dmg2, dmgType } = item;
    if (weaponCategory === undefined && dmg1 === undefined) return undefined;
    const type = dmgType === undefined ? null : (DAMAGE_TYPES[dmgType] ?? dmgType);
    const both = item.bonusWeapon ?? 0;
    return {
      category: weaponCategory ?? null,
      damage: dmg1 === undefined ? null : { dice: dmg1, type },
      kind: item.type?.split("|")[0] === "R" ? ("ranged" as const) : ("melee" as const),
      ...(item.baseItem && { baseName: item.baseItem.split("|")[0] }),
      ...(!item.baseItem && item.staff && { baseName: "quarterstaff" }),
      ...(item.property && { properties: item.property }),
      ...(dmg2 && { versatileDamage: dmg2 }),
      bonus: {
        attack: both + (item.bonusWeaponAttack ?? 0),
        damage: both + (item.bonusWeaponDamage ?? 0),
      },
    };
  });

/**
 * An item row from `content.db`'s `items` table, addressed by `(name, source)`. `json`
 * carries the same entry shape a homebrew item does — see the module docs above — so
 * `homebrewItemSchema` validates either.
 */
export const itemRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  kind: z.enum(["item", "itemGroup", "baseitem", "magicvariant"]),
  type: z.string().nullable(),
  rarity: z.string().nullable(),
  requiresAttunement: z.boolean(),
  json: homebrewItemSchema,
});

export type ItemRecord = z.infer<typeof itemRecordSchema>;
