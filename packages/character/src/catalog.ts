import type {
  AdvantageMode,
  AdvantageRoll,
  CasterProgression,
  HitDie,
  PreparationRule,
  Size,
  SpellSlotTotal,
  Weapon,
} from "@dnd/rules";
import type { AbilityGrant } from "./abilityScore.ts";
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
 * name a weapon proficiency and a weapon mastery match. `bonus` is a magic weapon's, each roll's summed from
 * every field upstream states it in; `reference` is the row that granted it.
 */
export type WeaponTrait = Weapon & {
  name: string;
  /** The mastery properties the row states, or its base item's: `Topple` (XPHB). */
  mastery?: readonly ContentRef[];
  category: "simple" | "martial" | null;
  /** Feet, from the row's `range`; a thrown melee weapon states one too. */
  range?: { normal: number; long: number };
  /** The ammunition's uid as upstream writes it, lowercase: `arrow|phb`, or `energy cell` with no source. */
  ammoType?: string;
  reload?: number;
  damageType: string | null;
  bonus: { attack: number; damage: number; reference?: ContentRef };
};

/** What a race or item row grants, each damage type or condition lowercased as upstream writes it. */
export type DefenseTrait = {
  resist: readonly string[];
  immune: readonly string[];
  conditionImmune: readonly string[];
  vulnerable: readonly string[];
};

/** A race's grant, and the damage types a `choose` offers, from which the definition picks one. */
type RaceDefenseTrait = DefenseTrait & { resistChoice: readonly string[] };

/** The ammunition uids an inventory entry stands for, each with how many one unit of the entry holds. */
export type AmmunitionTrait = readonly { uid: string; count: number }[];

/** An item's grant, the name its chip cites, and whether it waits on attunement. */
export type ItemDefenseTrait = DefenseTrait & { name: string; requiresAttunement: boolean };

/** An item's effect on scores, and whether it waits on attunement. */
export type ItemAbilityTrait = AbilityGrant & { requiresAttunement: boolean };

/** A movement mode, as `Speed` names it. */
export type SpeedMode = keyof Speed;

/**
 * An item's `modifySpeed`. `static` sets a mode, `equal` makes it match another, `multiply`
 * scales it and `bonus` adds feet to one mode or, under `*`, to every mode the character has.
 */
export type SpeedModifier = {
  static?: Partial<Record<SpeedMode, number>>;
  equal?: Partial<Record<SpeedMode, SpeedMode>>;
  multiply?: Partial<Record<SpeedMode, number>>;
  bonus?: Partial<Record<SpeedMode | "*", number>>;
};

/**
 * What an item adds to armor class, saves, spell numbers, ability checks and the proficiency
 * bonus, the speeds it changes, the lowest d20 that crits with it, and whether it grants a
 * proficiency or a language, which upstream flags without naming. Whether it waits on
 * attunement rides along.
 */
export type ItemBonusTrait = {
  name: string;
  requiresAttunement: boolean;
  ac: number;
  save: number;
  concentration: number;
  spellAttack: number;
  spellSaveDc: number;
  spellDamage: number;
  abilityCheck: number;
  proficiencyBonus: number;
  grantsProficiency: boolean;
  grantsLanguage: boolean;
  critThreshold?: number;
  speed?: SpeedModifier;
};

/**
 * What worn armor costs its wearer: `stealth` imposes disadvantage on Stealth checks, and
 * `strength` is the score under which it cuts the wearer's walking speed.
 */
export type ArmorBurdenTrait = {
  name: string;
  requiresAttunement: boolean;
  stealth: boolean;
  strength?: number;
};

/**
 * One effect an item grants on a roll. `target` is the ability a save or check applies to,
 * absent for all of them, and a skill's name for a skill; `condition` is the short text of a
 * conditional effect, absent for one that always applies.
 */
type RollEffect = {
  mode: AdvantageMode;
  roll: AdvantageRoll;
  target?: string;
  condition?: string;
};

/** An item's advantage and disadvantage effects, whether it waits on attunement. */
export type ItemAdvantageTrait = {
  name: string;
  requiresAttunement: boolean;
  effects: readonly RollEffect[];
};

/**
 * What a container item holds. `weight` is the pounds it takes, absent where it states none
 * in pounds; `items` the most it takes of each thing, keyed `name|source` lowercased.
 */
export type ContainerTrait = {
  name: string;
  weightless: boolean;
  weight?: number;
  items: Readonly<Record<string, number>>;
};

/**
 * The catalog facts a derived block needs, each already resolved by the caller from
 * `content.db` or homebrew — never a raw 5etools shape, which is a catalog schema's job
 * to parse. Keyed the way the field that reads it already keys a lookup: `hitDice` and
 * `spellcastingAbilities` by `entryKey` of a `levels` entry's class, `armor` by
 * `entryKey` of an inventory entry's reference, `weights`, `weapons`, `itemDefenses`,
 * `itemAbilities`, `itemBonuses`, `itemAdvantages` and `armorBurdens` and `containers` by `itemKey` of the entry, the way `carriedWeight` reads it.
 */
export type CharacterCatalog = {
  hitDice: ReadonlyMap<string, HitDie>;
  /**
   * Keyed like `hitDice`: how many kinds of weapon the class's Weapon Mastery lets the
   * character use at their level in it, absent for a class without the feature.
   */
  weaponMasteryKinds: ReadonlyMap<string, number>;
  /** Absent for a class that grants no spellcasting, such as a Fighter with no casting subclass. */
  spellcastingAbilities: ReadonlyMap<string, Ability>;
  /**
   * Keyed like `spellcastingAbilities`, and absent for a class with no slot table, such
   * as Way of the Four Elements, which casts with neither slots nor a prepared list.
   */
  casterTables: ReadonlyMap<string, CasterTable>;
  skills: readonly SkillTrait[];
  /** Every size the race offers, never empty; the definition's `size` picks among them. */
  sizes: readonly Size[];
  speed: Speed;
  armor: ReadonlyMap<string, ArmorTrait>;
  weights: ReadonlyMap<string, number | null>;
  /** Absent for an item that is not a weapon. */
  weapons: ReadonlyMap<string, WeaponTrait>;
  /** The race's, or the subrace row's, which already holds its race's. */
  raceDefenses: RaceDefenseTrait;
  /** Keyed like `weapons`, and absent for an item that grants nothing. */
  itemDefenses: ReadonlyMap<string, ItemDefenseTrait>;
  /** Keyed like `weapons`, and absent for an item that changes no score. */
  itemAbilities: ReadonlyMap<string, ItemAbilityTrait>;
  /** Keyed like `weapons`, and absent for an item that adds to no armor class, save or spell number. */
  itemBonuses: ReadonlyMap<string, ItemBonusTrait>;
  /** Keyed like `weapons`, and absent for an item that grants no advantage or disadvantage. */
  itemAdvantages: ReadonlyMap<string, ItemAdvantageTrait>;
  /** Keyed like `weapons`, and absent for an item that states neither a Stealth penalty nor a Strength requirement. */
  armorBurdens: ReadonlyMap<string, ArmorBurdenTrait>;
  /** Keyed like `weapons`, and absent for an entry that is not ammunition. */
  ammunition: ReadonlyMap<string, AmmunitionTrait>;
  /** Keyed like `weapons`, and absent for an item that holds nothing. */
  containers: ReadonlyMap<string, ContainerTrait>;
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
