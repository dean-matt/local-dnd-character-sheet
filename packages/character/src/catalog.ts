import type {
  CasterProgression,
  HitDie,
  PreparationRule,
  Size,
  SpellSlotTotal,
  Weapon,
} from "@dnd/rules";
import type { Speed } from "./characterDerived.ts";
import type { Ability, ContentRef } from "./refs.ts";

/** One catalog skill row a derived block iterates: its ability, since a character stores none. */
export type SkillTrait = { ref: ContentRef; ability: Ability };

/**
 * What one equipped item contributes to armor class: its own number, and which
 * Dexterity rule it grants. `"shield"` stacks with worn armor rather than replacing it.
 */
export type ArmorTrait = { category: "light" | "medium" | "heavy" | "shield"; armorClass: number };

/**
 * What one weapon row attacks with: the fields `weaponAttack` reads, and the category and
 * name a weapon proficiency matches. `bonus` is a magic weapon's, each roll's summed from
 * every field upstream states it in; `reference` is the row that granted it.
 */
export type WeaponTrait = Weapon & {
  name: string;
  category: "simple" | "martial" | null;
  damageType: string | null;
  bonus: { attack: number; damage: number; reference?: ContentRef };
};

/** What a race or item row grants, each damage type or condition lowercased as upstream writes it. */
export type DefenseTrait = {
  resist: readonly string[];
  immune: readonly string[];
  conditionImmune: readonly string[];
};

/** An item's grant, the name its chip cites, and whether it waits on attunement. */
export type ItemDefenseTrait = DefenseTrait & { name: string; requiresAttunement: boolean };

/**
 * The catalog facts a derived block needs, each already resolved by the caller from
 * `content.db` or homebrew — never a raw 5etools shape, which is a catalog schema's job
 * to parse. Keyed the way the field that reads it already keys a lookup: `hitDice` and
 * `spellcastingAbilities` by `entryKey` of a `levels` entry's class, `armor` by
 * `entryKey` of an inventory entry's reference, `weights`, `weapons` and `itemDefenses` by
 * `itemKey` of the entry, the way `carriedWeight` reads it.
 */
export type CharacterCatalog = {
  hitDice: ReadonlyMap<string, HitDie>;
  /** Absent for a class that grants no spellcasting, such as a Fighter with no casting subclass. */
  spellcastingAbilities: ReadonlyMap<string, Ability>;
  /**
   * Keyed like `spellcastingAbilities`, and absent for a class with no slot table, such
   * as Way of the Four Elements, which casts with neither slots nor a prepared list.
   */
  casterTables: ReadonlyMap<string, CasterTable>;
  skills: readonly SkillTrait[];
  size: Size;
  speed: Speed;
  armor: ReadonlyMap<string, ArmorTrait>;
  weights: ReadonlyMap<string, number | null>;
  /** Absent for an item that is not a weapon. */
  weapons: ReadonlyMap<string, WeaponTrait>;
  /** The race's, or the subrace row's, which already holds its race's. */
  raceDefenses: DefenseTrait;
  /** Keyed like `weapons`, and absent for an item that grants nothing. */
  itemDefenses: ReadonlyMap<string, ItemDefenseTrait>;
};

/**
 * How a class counts the spells it may prepare: the `classic` arithmetic `rule`, or the
 * `one` count its table prints at the character's level in it.
 */
export type Preparation = { rule: PreparationRule } | { printed: number };

/**
 * One casting class's slot table, read at the character's level in that class. `slots`
 * is its own table's row, or its subclass's for an Eldritch Knight.
 */
export type CasterTable = {
  progression: CasterProgression;
  slots: readonly SpellSlotTotal[];
  preparation?: Preparation;
};
