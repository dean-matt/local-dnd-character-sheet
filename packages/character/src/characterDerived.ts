import {
  ADVANTAGE_MODES,
  ADVANTAGE_ROLLS,
  ENCUMBRANCE_TIERS,
  GRIPS,
  HIT_DICE,
  SIZES,
} from "@dnd/rules";
import { z } from "zod";
import { derivedSchema } from "./derivedField.ts";
import { abilitySchema, contentRefSchema, entryRefSchema } from "./refs.ts";

/**
 * Feet per round, by movement mode. Every race grants a walking speed, so `walk` is
 * required and the rest stay absent until a race grants them. No upstream race grants a
 * burrowing speed, so an override is the only thing that reaches `burrow`.
 *
 * Upstream spells a mode equal to the walking speed as `true`, which the caller resolves.
 */
const speedSchema = z.strictObject({
  walk: z.int().min(0),
  burrow: z.int().min(0).optional(),
  climb: z.int().min(0).optional(),
  fly: z.int().min(0).optional(),
  swim: z.int().min(0).optional(),
});

/** One damage type or condition, and every race or item label that grants it. */
const defenseSchema = z.strictObject({
  name: z.string().min(1),
  from: z.array(z.string().min(1)).min(1),
});

const defensesSchema = z.strictObject({
  resistances: z.array(defenseSchema),
  damageImmunities: z.array(defenseSchema),
  conditionImmunities: z.array(defenseSchema),
  vulnerabilities: z.array(defenseSchema),
  /** The race's choice of resistance while the definition stores no pick it offers. */
  resistanceChoice: z
    .strictObject({ from: z.string().min(1), options: z.array(z.string().min(1)).min(1) })
    .nullable(),
});

/** The names of the equipped items that grant a proficiency or a language, which upstream flags without naming. */
const itemGrantsSchema = z.strictObject({
  proficiencies: z.array(z.string().min(1)),
  languages: z.array(z.string().min(1)),
});

/** One advantage or disadvantage an equipped item grants, with the item to cite and its condition if it has one. */
const rollEffectSchema = z.strictObject({
  item: z.string().min(1),
  mode: z.enum(ADVANTAGE_MODES),
  roll: z.enum(ADVANTAGE_ROLLS),
  target: z.string().min(1).optional(),
  condition: z.string().min(1).optional(),
});

/**
 * What the sheet computes, each beside the value a user typed over it. Assembled on
 * read rather than stored: `computed` comes from the definition and the catalog rows it
 * names, `manual` from the definition's `overrides`.
 */
export const characterDerivedSchema = z.strictObject({
  /** Base, increases and each worn item's effect as its own term; every number below reads the computed score,
   * so a manual override shows on the tile and moves nothing else. */
  abilityScores: z.record(abilitySchema, derivedSchema(z.int())),
  abilityModifiers: z.record(abilitySchema, derivedSchema(z.int())),
  hitPointMaximum: derivedSchema(z.int().min(1)),
  /**
   * Grouped by die size the way `hitDicePoolSchema` groups the pool a rest spends, in the
   * order each die was first taken. `total` is the pool's size; what remains is state.
   */
  hitDice: z.array(
    z.strictObject({ die: z.literal(HIT_DICE), total: derivedSchema(z.int().min(1)) }),
  ),
  /**
   * The race's size, in the vocabulary `carryingCapacity` reads, so the two cannot
   * drift. A subrace never states one — all 98 upstream rows leave it to the race — so
   * only a race change or the definition's `size` pick moves it.
   */
  size: derivedSchema(z.enum(SIZES)),
  /**
   * The race's speeds, one field rather than one per mode because a subrace that states
   * a speed replaces the set outright rather than adding to it — a Wood Elf walks 35
   * feet, not the Elf's 30 and 5 more.
   */
  speed: derivedSchema(speedSchema),
  proficiencyBonus: derivedSchema(z.int().min(2)),
  /** Every ability, since an unproficient save is still a number the sheet shows. */
  savingThrows: z.record(abilitySchema, derivedSchema(z.int())),
  /** The Constitution save plus what an equipped item adds to concentration saves; null while no item adds any. */
  concentrationSave: derivedSchema(z.int()).nullable(),
  /** What equipped items add to a spell's damage, one term per item; null while none adds any. */
  spellDamageBonus: derivedSchema(z.int()).nullable(),
  /**
   * One entry per catalog skill row the caller hands in — every skill of the
   * character's edition, proficient or not, so the sheet has a full list to render
   * rather than only the ones a player picked.
   */
  skills: z.array(
    z.strictObject({
      ref: contentRefSchema,
      ability: abilitySchema,
      modifier: derivedSchema(z.int()),
      passive: derivedSchema(z.int()),
    }),
  ),
  armorClass: derivedSchema(z.int()),
  initiative: derivedSchema(z.int()),
  /**
   * One entry per class that casts, since a multiclassed caster sets a different DC
   * and attack bonus per class rather than one figure for the whole character. Empty
   * for a character with no caster class.
   */
  spellcasting: z.array(
    z.strictObject({
      class: entryRefSchema,
      ability: abilitySchema,
      saveDc: derivedSchema(z.int()),
      attackBonus: derivedSchema(z.int()),
      /** How many spells the class may prepare, absent for a class that knows its spells instead. */
      preparedSpells: derivedSchema(z.int().min(0)).optional(),
    }),
  ),
  /** Slots by slot level, lowest first, omitting a level with none. */
  spellSlots: z.array(
    z.strictObject({ level: z.int().min(1).max(9), total: derivedSchema(z.int().min(1)) }),
  ),
  /** Pact magic's slots, all one level and recharged on a short rest, kept apart from `spellSlots`. */
  pactSlots: z
    .strictObject({ level: z.int().min(1).max(9), total: derivedSchema(z.int().min(1)) })
    .nullable(),
  /** Pounds, from the Strength score and `size`. */
  carryingCapacity: derivedSchema(z.number().min(0)),
  /**
   * `carriedWeight`'s pounds. A plain number rather than a `Derived`, because the
   * inventory it sums is where a player changes it.
   */
  carriedWeight: z.number().min(0),
  /**
   * One per inventory entry that holds things, in inventory order, with the amount by which
   * its contents pass what it takes. `entry` is the index in the definition's `inventory`;
   * `unit` is `lb` or the lowercased `name|source` of a counted thing.
   */
  containers: z.array(
    z.strictObject({
      entry: z.int().min(0),
      name: z.string().min(1),
      overflow: z.array(z.strictObject({ excess: z.number().positive(), unit: z.string().min(1) })),
    }),
  ),
  /** Null where the table plays without the encumbrance variant. */
  encumbrance: z.enum(ENCUMBRANCE_TIERS).nullable(),
  attunementSlots: derivedSchema(z.int().min(0)),
  /** How many kinds of weapon the classes' Weapon Mastery features allow, one term per class; 0 on a 2014 character. */
  weaponMasteryLimit: derivedSchema(z.int().min(0)),
  /**
   * One per carried weapon, in inventory order. `entry` is the weapon's index in the
   * definition's `inventory`, since two entries may hold the same item. `grip` is null for
   * a weapon with one die; `twoHandedBlocked` is a versatile weapon equipped beside a
   * shield, held one-handed whatever grip the entry stores.
   */
  attacks: z.array(
    z.strictObject({
      entry: z.int().min(0),
      ability: z.enum(["str", "dex"]),
      attackBonus: derivedSchema(z.int()),
      /** The lowest d20 result that scores a critical hit: 20, or lower while an item says so. */
      critThreshold: derivedSchema(z.int().min(2).max(20)),
      damage: z
        .strictObject({
          dice: z.string().min(1),
          type: z.string().min(1).nullable(),
          modifier: derivedSchema(z.int()),
        })
        .nullable(),
      grip: z.strictObject({ held: z.enum(GRIPS), twoHandedBlocked: z.boolean() }).nullable(),
      /** The mastery properties the character may use with this weapon: empty unless its kind is among the chosen. */
      mastery: z.array(contentRefSchema),
      /** Feet, null for a weapon that states no range. */
      range: z.strictObject({ normal: z.int().min(0), long: z.int().min(0) }).nullable(),
      /** The ammunition a weapon fires, as the lowercase uid it names, and how many the carried inventory holds. Null for a weapon that fires none. */
      ammunition: z.strictObject({ type: z.string().min(1), carried: z.int().min(0) }).nullable(),
      /** A firearm's shots between reloads, null for any other weapon. */
      reload: z.int().min(1).nullable(),
    }),
  ),
  /** Resistances, immunities and vulnerabilities from the race, then from each equipped item, attuned where it must be. */
  defenses: derivedSchema(defensesSchema),
  /** Which equipped items grant a proficiency or a language, attuned where they must be. */
  itemGrants: derivedSchema(itemGrantsSchema),
  /**
   * The advantage and disadvantage equipped items grant, attuned where they must be, in
   * inventory order. Nothing here cancels a pair: the table decides whether a condition holds.
   */
  rollEffects: derivedSchema(z.array(rollEffectSchema)),
});

export type CharacterDerived = z.infer<typeof characterDerivedSchema>;
export type Speed = z.infer<typeof speedSchema>;
export type RollEffectEntry = z.infer<typeof rollEffectSchema>;
export type Defenses = z.infer<typeof defensesSchema>;
