import {
  ABILITIES,
  ABILITY_LABEL,
  abilityModifier,
  abilityModifierBreakdown,
  armorClass,
  attunementSlots,
  type Breakdown,
  breakdown,
  type CasterProgression,
  carryingCapacity,
  encumbranceAt,
  type HitDie,
  isLight,
  isTwoHanded,
  maxHitPoints,
  multiclassCasterLevel,
  multiclassSlots,
  type ProficiencyLevel,
  passiveScore,
  preparedSpellCount,
  proficiencyBonusBreakdown,
  proficiencyContribution,
  SENSES,
  SIZES,
  type Size,
  type SpellSlotTotal,
  spellAttackBonus,
  spellSaveDc,
  type Term,
  weaponAttack,
} from "@dnd/rules";
import {
  type AbilityGrant,
  abilityScore,
  abilityScoreBreakdown,
  pickedGrant,
  validPicks,
} from "./abilityScore.ts";
import { armorClassEffects } from "./armorClassEffects.ts";
import type {
  ArmorBurdenTrait,
  ArmorTrait,
  CharacterCatalog,
  DefenseTrait,
  ItemBonusTrait,
  Preparation,
  SenseGrant,
  WeaponTrait,
} from "./catalog.ts";
import type { CharacterDerived, Defenses } from "./characterDerived.ts";
import { classResourcePools } from "./classResources.ts";
import { speedWithConditions } from "./conditionSpeed.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { exhaustedMaximum } from "./exhaustedMaximum.ts";
import { exhaustionPenaltyTerms } from "./exhaustionPenalty.ts";
import {
  featHitPointTerms,
  featInitiativeTerms,
  initiativeUsesProficiency,
  speedMatchingWalk,
  speedWithFeats,
} from "./featEffects.ts";
import { featGrants, withFeatGrants } from "./featGrants.ts";
import {
  type DamageSheet,
  type FeatureStrike,
  featureAttackEffects,
  featureDamage,
  featureStrike,
} from "./featureAttacks.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { featureRestores } from "./featureRestores.ts";
import { featureRolls, rollBonusTerms } from "./featureRolls.ts";
import { halfProficiencyTerm } from "./halfProficiency.ts";
import {
  type ProficiencyItem,
  proficiencyItemTerms,
  speedUnderArmor,
  speedWithItems,
} from "./itemEffects.ts";
import { entryKey, itemKey, refKey } from "./keys.ts";
import { carriedWeight, containerOverflows } from "./load.ts";
import { martialArts } from "./martialArts.ts";
import { reducedMaximum, reducedOverride } from "./maximumReduction.ts";
import { applyOverrides } from "./overrides.ts";
import { rageBenefits, rageDamageTerms } from "./rage.ts";
import { type Ability, type ContentRef, catalogRef, type EntryRef } from "./refs.ts";
import { exhaustionRuleset, houseRule } from "./resolve.ts";
import type { CharacterState } from "./state.ts";
import { subclassInitiativeTerms } from "./subclassEffects.ts";
import { classLevels, type HomebrewNames, raceSummary, totalLevel } from "./summaries.ts";
import {
  MODIFIER_REFERENCE,
  modifierTerms,
  onKind,
  onSave,
  onSkill,
  speedWithModifiers,
  withModifiers,
} from "./temporaryModifiers.ts";
import { speedWithUnarmoredMovement } from "./unarmoredMovement.ts";

/**
 * The hit point maximum for a stored character.
 *
 * `hitDice` maps a class to its die, keyed by `entryKey` — a class is catalog or
 * homebrew data a character references rather than copies. A class the map does not
 * name is rejected rather than defaulted, since a guessed die invents hit points. A feat
 * such as Tough adds its own term after the levels.
 */
export function hitPointMaximum(
  definition: CharacterDefinition,
  hitDice: ReadonlyMap<string, HitDie>,
  grants: readonly AbilityGrant[] = [],
): Breakdown<TermReference> {
  const levels = definition.levels.map((level) => {
    const key = entryKey(level.class);
    const die = hitDice.get(key);
    if (die === undefined) throw new RangeError(`No hit die for ${key}`);
    return { die, rolled: level.rolled, typed: level.typed };
  });
  const { terms } = maxHitPoints<TermReference>(
    levels,
    abilityModifier(abilityScore(definition, "con", grants)),
  );
  return breakdown([...terms, ...featHitPointTerms(definition)]);
}

/**
 * The passive score for one skill: 10, the ability modifier, and whatever the character's
 * proficiency in that skill is worth at this level.
 *
 * `ability` is the `skills` row's own, catalog data a character references rather than
 * copies, the way `hitPointMaximum` takes the hit die. A skill the character lists no
 * entry for scores as unproficient rather than throwing: every skill has a passive score,
 * and only the proficiency is optional.
 */
export function passiveSkill(
  definition: CharacterDefinition,
  skill: ContentRef,
  ability: Ability | "flat",
  grants: readonly AbilityGrant[] = [],
  bonuses: readonly Term<TermReference>[] = [],
  proficiencyItems: readonly ProficiencyItem[] = [],
): number {
  return passiveScore(
    skillModifier(definition, skill, ability, grants, bonuses, proficiencyItems).total,
    0,
  );
}

/** What a check modifier reads, which a creation draft holds before the rest of the definition. */
type Scored = Pick<
  CharacterDefinition,
  "abilityScores" | "abilityIncreases" | "proficiencies" | "levels"
>;

/**
 * The check modifier for one skill: the ability modifier and whatever the character's
 * proficiency in that skill is worth, then each of `bonuses` and each of `proficiencyItems`
 * as its own term. Companion to `passiveSkill`, which takes the same inputs to the passive
 * score instead.
 */
export function skillModifier(
  definition: Scored,
  skill: ContentRef,
  ability: Ability | "flat",
  grants: readonly AbilityGrant[] = [],
  bonuses: readonly Term<TermReference>[] = [],
  proficiencyItems: readonly ProficiencyItem[] = [],
): Breakdown<TermReference> {
  const key = refKey(skill);
  const entry = definition.proficiencies.skills.find((held) => refKey(held.ref) === key);
  const level = entry?.level ?? "none";
  return checkModifier(
    definition,
    ability === "flat" ? { flat: entry?.flat ?? 0, level } : { ability, level, reference: skill },
    grants,
    bonuses,
    proficiencyItems,
  );
}

/** A skill check's terms, whether the skill is a catalog row or one of the character's own. */
function checkModifier(
  definition: Scored,
  skill: { level: ProficiencyLevel; reference?: ContentRef } & (
    | { ability: Ability }
    | { flat: number }
  ),
  grants: readonly AbilityGrant[],
  bonuses: readonly Term<TermReference>[],
  proficiencyItems: readonly ProficiencyItem[],
): Breakdown<TermReference> {
  const level = totalLevel(definition);
  const contribution = proficiencyContribution(level, skill.level);
  const terms: Term<TermReference>[] = [
    "ability" in skill
      ? {
          label: ABILITY_LABEL[skill.ability],
          value: abilityModifier(abilityScore(definition, skill.ability, grants)),
          ...(skill.reference && { reference: skill.reference }),
        }
      : { label: "Flat bonus", value: skill.flat },
  ];
  if (contribution !== 0) terms.push({ label: "Proficiency", value: contribution });
  return breakdown([
    ...terms,
    ...proficiencyItemTerms(level, skill.level, proficiencyItems),
    ...bonuses,
  ]);
}

/**
 * The saving throw modifier for one ability: its modifier, proficiency where
 * `proficiencies.savingThrows` names it, then each of `proficiencyItems` and `bonuses` as
 * its own term. Only the character's first class grants a
 * saving throw proficiency in 5e, so that choice is already resolved into this list
 * rather than read again from a class row here.
 */
export function savingThrowModifier(
  definition: Scored,
  ability: Ability,
  grants: readonly AbilityGrant[] = [],
  bonuses: readonly Term<TermReference>[] = [],
  proficiencyItems: readonly ProficiencyItem[] = [],
): Breakdown<TermReference> {
  const proficiency = definition.proficiencies.savingThrows.includes(ability)
    ? "proficient"
    : "none";
  const level = totalLevel(definition);
  const contribution = proficiencyContribution(level, proficiency);
  const terms: Term<TermReference>[] = [
    {
      label: ABILITY_LABEL[ability],
      value: abilityModifier(abilityScore(definition, ability, grants)),
    },
  ];
  if (contribution !== 0) terms.push({ label: "Proficiency", value: contribution });
  return breakdown([
    ...terms,
    ...proficiencyItemTerms(level, proficiency, proficiencyItems),
    ...bonuses,
  ]);
}

/** A freshly computed derived field, always with its terms — never read back from storage. */
type ComputedField<T> = { computed: T; manual: null; terms: Term<TermReference>[] };

const fromBreakdown = (result: Breakdown<TermReference>): ComputedField<number> => ({
  computed: result.total,
  manual: null,
  terms: result.terms,
});

const DEXTERITY_CAP: Record<Exclude<ArmorTrait["category"], "shield">, number | "none" | "all"> = {
  light: "all",
  medium: 2,
  heavy: "none",
};

type WornArmor = {
  category: Exclude<ArmorTrait["category"], "shield">;
  armorClass: number;
  ref: EntryRef;
};
type WornShield = { armorClass: number; ref: EntryRef; trait: ArmorTrait };

/** The worn armor and the shield a character has equipped, last one of each wins. */
function equippedArmor(
  definition: CharacterDefinition,
  armor: ReadonlyMap<string, ArmorTrait>,
): { worn?: WornArmor; shield?: WornShield } {
  let worn: WornArmor | undefined;
  let shield: WornShield | undefined;
  for (const entry of definition.inventory) {
    if (!entry.equipped) continue;
    const trait = armor.get(itemKey(entry));
    if (trait === undefined) continue;
    if (trait.category === "shield") {
      shield = { armorClass: trait.armorClass, ref: entry.ref, trait };
    } else {
      worn = { category: trait.category, armorClass: trait.armorClass, ref: entry.ref };
    }
  }
  return { worn, shield };
}

/**
 * Melee weapons in hand: an equipped stack counts every weapon in it, so two equipped
 * daggers are two weapons, and a two-handed weapon, or a versatile one gripped in two
 * hands, fills both hands and cannot be paired, so it adds none.
 */
function heldMeleeWeapons(definition: CharacterDefinition, catalog: CharacterCatalog): number {
  let held = 0;
  for (const entry of definition.inventory) {
    const weapon = catalog.weapons.get(itemKey(entry));
    if (!entry.carried || !entry.equipped || weapon?.kind !== "melee") continue;
    const bothHands =
      isTwoHanded(weapon) || (weapon.versatileDamage !== undefined && entry.grip === "two-handed");
    if (!bothHands) held += entry.quantity;
  }
  return held;
}

/**
 * Armor class from whatever the character has equipped. An item `armor` does not name —
 * the reference no longer resolves, or nothing is equipped — degrades to the unarmored
 * base of 10 rather than throwing, since one missing suit of armor is not a reason to
 * refuse the rest of the sheet.
 *
 * Wearing no armor, the best unarmored base a held feature records adds its term to the
 * base of 10.
 *
 * A 2024 shield used without training adds no bonus (Armor Training), yet still counts as
 * held for an unarmored base, which a shield can also end.
 */
function derivedArmorClass(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  modifiers: readonly Term<TermReference>[],
): ComputedField<number> {
  const { worn, shield } = equippedArmor(definition, catalog.armor);
  const effects = armorClassEffects(definition, {
    armor: worn?.category ?? "none",
    shield: shield !== undefined,
    meleeWeapons: heldMeleeWeapons(definition, catalog),
    dexterityScore: scoreOf(definition, catalog, "dex"),
    modifierOf: (ability) => abilityModifier(scoreOf(definition, catalog, ability)),
  });
  const unarmored = worn ? undefined : effects.unarmoredBase;
  const untrainedShield =
    shield !== undefined &&
    definition.edition === "one" &&
    !armorProficient(definition, shield.trait);
  const bonus = [
    ...(unarmored ? [unarmored] : []),
    ...(untrainedShield
      ? [{ label: "Shield (not proficient)", value: 0, reference: catalogRef(shield.ref) }]
      : []),
    ...effects.bonus,
    ...itemTerms(equippedBonuses(definition, catalog), (item) => item.ac),
    ...modifiers,
  ];
  const mediumCap = effects.mediumDexterityCap ?? DEXTERITY_CAP.medium;
  const result = armorClass<TermReference>({
    base: worn ? { value: worn.armorClass, reference: catalogRef(worn.ref) } : { value: 10 },
    dexterityModifier: { value: abilityModifier(scoreOf(definition, catalog, "dex")) },
    dexterityCap: worn
      ? worn.category === "medium"
        ? mediumCap
        : DEXTERITY_CAP[worn.category]
      : "all",
    shield:
      shield && !untrainedShield
        ? { value: shield.armorClass, reference: catalogRef(shield.ref) }
        : undefined,
    bonus,
  });
  return { computed: result.total, manual: null, terms: result.terms };
}

/**
 * The typed form of an armor, weapon or category name, folded so the spellings the book
 * prints (`Simple weapons`, `Longswords`, `Heavy Armor`) meet the bare ones (`Simple`,
 * `Longsword`, `heavy`). Both sides pass through it, so a name that ends in `s` still
 * meets itself.
 */
export function proficiencyKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+(armor|weapons?)$/, "")
    .replace(/s$/, "");
}

/** A weapon proficiency names a category or one weapon: `Simple`, `Longsword`. */
function weaponProficient(definition: CharacterDefinition, weapon: WeaponTrait): boolean {
  const held = new Set(definition.proficiencies.weapons.map(proficiencyKey));
  return (
    (weapon.category !== null && held.has(proficiencyKey(weapon.category))) ||
    held.has(proficiencyKey(weapon.name))
  );
}

/**
 * An armor proficiency names a category or one armor: `Light`, `Shields`, `Elven Chain`.
 * Upstream's `grantsProficiency` flag names no proficiency, and on most weapons it flags
 * a tool or a skill, so an item that covers itself, as `Elven Chain` (DMG) does, reaches
 * the sheet as a proficiency the player names.
 */
function armorProficient(definition: CharacterDefinition, armor: ArmorTrait): boolean {
  const held = new Set(definition.proficiencies.armor.map(proficiencyKey));
  return held.has(proficiencyKey(armor.category)) || held.has(proficiencyKey(armor.name));
}

/** The proficiency the sheet names for a missing one: the weapon's category, or the weapon where it has none. */
function weaponRequires(weapon: WeaponTrait): string {
  return weapon.category === "simple"
    ? "Simple weapons"
    : weapon.category === "martial"
      ? "Martial weapons"
      : weapon.name;
}

const ARMOR_REQUIRES: Record<ArmorTrait["category"], string> = {
  light: "Light armor",
  medium: "Medium armor",
  heavy: "Heavy armor",
  shield: "Shields",
};

/** Each inventory entry holding a weapon or armor the character lacks proficiency with, equipped or not. */
function derivedUnproficientItems(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): CharacterDerived["unproficientItems"] {
  return definition.inventory.flatMap((entry, index) => {
    const weapon = catalog.weapons.get(itemKey(entry));
    if (weapon && !weaponProficient(definition, weapon)) {
      return [{ entry: index, requires: weaponRequires(weapon) }];
    }
    const armor = catalog.armor.get(itemKey(entry));
    if (armor && !armorProficient(definition, armor)) {
      return [{ entry: index, requires: ARMOR_REQUIRES[armor.category] }];
    }
    return [];
  });
}

/**
 * The names of the equipped armor the character lacks proficiency with, in inventory
 * order. A 2014 shield counts as armor; a 2024 one costs only its own AC bonus, which
 * `derivedArmorClass` withholds, so it is left out here.
 */
function unproficientArmorWorn(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): string[] {
  return definition.inventory.flatMap((entry) => {
    const armor = catalog.armor.get(itemKey(entry));
    if (!entry.equipped || !armor || armorProficient(definition, armor)) return [];
    return definition.edition === "one" && armor.category === "shield" ? [] : [armor.name];
  });
}

/**
 * The mastery properties a chosen weapon kind gives, matched by name the way a weapon
 * proficiency is: a named magic item answers to its base item. A 2014 character has none.
 */
function weaponMastery(definition: CharacterDefinition, weapon: WeaponTrait): ContentRef[] {
  if (definition.edition !== "one") return [];
  const name = weapon.name.toLowerCase();
  const chosen = definition.weaponMasteries.some((kind) => kind.name.toLowerCase() === name);
  return chosen ? [...(weapon.mastery ?? [])] : [];
}

function weaponMasteryLimit(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): Breakdown<TermReference> {
  if (definition.edition !== "one") return breakdown([]);
  const classes = new Map(definition.levels.map(({ class: ref }) => [entryKey(ref), ref]));
  return breakdown(
    [...classes].flatMap(([key, ref]) => {
      const value = catalog.weaponMasteryKinds.get(key) ?? 0;
      return value > 0 && !("homebrewId" in ref)
        ? [{ label: ref.name, value, reference: ref }]
        : [];
    }),
  );
}

/**
 * The carried entries that are loose one-piece ammunition of `type`, by inventory index. A
 * pack such as `Arrows (20)` is neither listed nor counted. A type with no source
 * (`energy cell`) matches any source, as upstream leaves it open.
 */
function looseAmmunition(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  type: string,
): { entry: number; quantity: number }[] {
  const sourced = type.includes("|");
  return definition.inventory.flatMap((entry, index) => {
    const held = entry.carried ? (catalog.ammunition.get(itemKey(entry)) ?? []) : [];
    const loose = held.some(
      ({ uid, count }) => count === 1 && (sourced ? uid === type : uid.split("|")[0] === type),
    );
    return loose ? [{ entry: index, quantity: entry.quantity }] : [];
  });
}

/** The range, the ammunition fired with the loose stacks carried, and the reload, each null where the weapon states none. */
function rangedFacts(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  { range, ammoType, reload }: WeaponTrait,
) {
  return {
    range: range ?? null,
    ammunition: ammoType
      ? { type: ammoType, stacks: looseAmmunition(definition, catalog, ammoType) }
      : null,
    reload: reload ?? null,
  };
}

/**
 * One attack per carried weapon. A shield counts only while equipped, as armor class reads
 * it. A second die is what makes a weapon versatile: every upstream row with a `dmg2`
 * carries the `V` property, and none carries `V` without one.
 */
function derivedAttacks(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  bonuses: readonly ItemBonusTrait[],
  rage: RageBenefits,
  modifiers: readonly Term<TermReference>[],
): CharacterDerived["attacks"] {
  return definition.inventory.flatMap((entry, index) => {
    const weapon = catalog.weapons.get(itemKey(entry));
    if (!entry.carried || weapon === undefined) return [];
    return [
      weaponStrike(definition, catalog, bonuses, rage, modifiers, { entry, index, weapon }, false),
    ];
  });
}

/** Reads a class table column's catalog cell at the character's level in that class. */
function tableColumn(definition: CharacterDefinition, catalog: CharacterCatalog) {
  const cells = classLevels(definition).flatMap(
    (group) => catalog.classResources.get(entryKey(group.class)) ?? [],
  );
  return (key: string) => cells.find((cell) => cell.key === key && !cell.homebrew)?.value;
}

/** What a weapon or unarmed strike reads off the sheet for the damage features add, and the Martial Arts the character holds. */
function strikeSheet(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  rage: RageBenefits,
) {
  const column = tableColumn(definition, catalog);
  const sheet: DamageSheet = {
    column,
    modifier: (ability) => abilityModifier(scoreOf(definition, catalog, ability)),
    raging: rage !== null,
  };
  const { worn, shield } = equippedArmor(definition, catalog.armor);
  const equipped = definition.inventory.flatMap((entry) => {
    const weapon = entry.equipped ? catalog.weapons.get(itemKey(entry)) : undefined;
    return weapon ? [weapon] : [];
  });
  const monk = martialArts(definition, {
    armored: worn !== undefined || shield !== undefined,
    equipped,
    column,
  });
  return { sheet, monk };
}

function weaponStrike(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  bonuses: readonly ItemBonusTrait[],
  rage: RageBenefits,
  modifiers: readonly Term<TermReference>[],
  {
    entry,
    index,
    weapon,
  }: { entry: CharacterDefinition["inventory"][number]; index: number; weapon: WeaponTrait },
  offHand: boolean,
): CharacterDerived["attacks"][number] {
  const shield = equippedArmor(definition, catalog.armor).shield !== undefined;
  const level = totalLevel(definition);
  const { sheet, monk } = strikeSheet(definition, catalog, rage);
  const twoHandedBlocked = entry.equipped && shield;
  const held = twoHandedBlocked ? "one-handed" : (entry.grip ?? "one-handed");
  const { reference } = weapon.bonus;
  const proficiency = weaponProficient(definition, weapon) ? "proficient" : "none";
  const features = featureStrike(definition, {
    weapon,
    proficient: proficiency === "proficient",
    alone:
      !offHand &&
      held === "one-handed" &&
      !isTwoHanded(weapon) &&
      !definition.inventory.some(
        (other, at) => at !== index && other.equipped && catalog.weapons.has(itemKey(other)),
      ),
  });
  const result = weaponAttack<TermReference>({
    weapon: monk?.covers(weapon) ? monk.apply(weapon) : weapon,
    strengthModifier: abilityModifier(scoreOf(definition, catalog, "str")),
    dexterityModifier: abilityModifier(scoreOf(definition, catalog, "dex")),
    proficiency: proficiencyContribution(level, proficiency),
    attackBonus: { value: weapon.bonus.attack, reference },
    damageBonus: { value: weapon.bonus.damage, reference },
    grip: held,
    offHand,
  });
  return {
    extraDamage: extraDamage(definition, catalog, index),
    featureDamage: featureDamage(
      definition,
      { weapon, proficient: proficiency === "proficient", alone: false },
      sheet,
    ),
    entry: index,
    ability: result.ability,
    attackBonus: fromBreakdown(
      breakdown([
        ...result.attack.terms,
        ...(proficiency === "none" ? [{ label: "Not proficient", value: 0 }] : []),
        ...proficiencyItemTerms(level, proficiency, bonuses),
        ...features.attack,
        ...modifiers,
      ]),
    ),
    critThreshold: fromBreakdown(critThreshold(critItems(definition, catalog, index), features)),
    damage: result.damage
      ? {
          dice: result.damage.dice,
          type: weapon.damageType,
          modifier: fromBreakdown(
            breakdown([
              ...result.damage.modifier.terms,
              ...rageDamageTerms(rage, definition.edition, weapon.kind, result.ability),
              ...features.damage,
            ]),
          ),
        }
      : null,
    options: features.options,
    grip: weapon.versatileDamage === undefined ? null : { held, twoHandedBlocked },
    mastery: weaponMastery(definition, weapon),
    ...rangedFacts(definition, catalog, weapon),
  };
}

/** The second equipped light melee weapon's bonus-action attack, null while fewer than two are equipped. */
function derivedOffHandAttack(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  bonuses: readonly ItemBonusTrait[],
  rage: RageBenefits,
  modifiers: readonly Term<TermReference>[],
): CharacterDerived["offHandAttack"] {
  const [, second] = definition.inventory.flatMap((entry, index) => {
    const weapon = catalog.weapons.get(itemKey(entry));
    return entry.carried && entry.equipped && weapon?.kind === "melee" && isLight(weapon)
      ? [{ entry, index, weapon }]
      : [];
  });
  if (second === undefined) return null;
  return weaponStrike(definition, catalog, bonuses, rage, modifiers, second, true);
}

/** The flat 1 an unarmed strike deals, as the one-faced die the roller needs to start a roll with. */
const UNARMED_DICE = "1d1";

/**
 * Every character's unarmed strike: proficient, Strength-based, 1 bludgeoning plus Strength,
 * in either edition, unless Martial Arts offers Dexterity or a die.
 */
function derivedUnarmedStrike(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  bonuses: readonly ItemBonusTrait[],
  rage: RageBenefits,
  modifiers: readonly Term<TermReference>[],
): CharacterDerived["unarmedStrike"] {
  const level = totalLevel(definition);
  const strength = abilityModifier(scoreOf(definition, catalog, "str"));
  const features = featureStrike(definition, { proficient: true, alone: false });
  const { sheet, monk } = strikeSheet(definition, catalog, rage);
  const unarmed = { kind: "melee" as const, damage: UNARMED_DICE };
  const weapon = monk ? monk.apply(unarmed) : unarmed;
  const result = weaponAttack<TermReference>({
    weapon,
    strengthModifier: strength,
    dexterityModifier: abilityModifier(scoreOf(definition, catalog, "dex")),
    proficiency: proficiencyContribution(level, "proficient"),
    grip: "one-handed",
  });
  return {
    extraDamage: extraDamage(definition, catalog, -1),
    featureDamage: featureDamage(definition, { proficient: true, alone: false }, sheet),
    attackBonus: fromBreakdown(
      breakdown([
        ...result.attack.terms,
        ...proficiencyItemTerms(level, "proficient", bonuses),
        ...features.attack,
        ...modifiers,
      ]),
    ),
    critThreshold: fromBreakdown(critThreshold(critItems(definition, catalog, -1), features)),
    damage: {
      dice: weapon.damage,
      type: "bludgeoning",
      modifier: fromBreakdown(
        breakdown([
          ...(result.damage?.modifier.terms ?? []),
          ...rageDamageTerms(rage, definition.edition, "melee", result.ability),
          ...features.damage,
        ]),
      ),
    },
  };
}

/**
 * The items whose critical threshold applies to the attack at inventory `index`: a weapon
 * item lowers the threshold of its own attack only, and any other item lowers every attack's.
 */
function critItems(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  index: number,
): ItemBonusTrait[] {
  return definition.inventory.flatMap((entry, at) => {
    const item = catalog.itemBonuses.get(itemKey(entry));
    const worn = item && entry.equipped && (entry.attuned || !item.requiresAttunement);
    return worn && (at === index || !catalog.weapons.has(itemKey(entry))) ? [item] : [];
  });
}

/** The extra damage of the items `critItems` names for the attack at `index`, each named for its item. */
function extraDamage(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  index: number,
): CharacterDerived["attacks"][number]["extraDamage"] {
  return critItems(definition, catalog, index).flatMap(({ name, extraDamage: extra }) =>
    extra ? [{ source: name, ...extra }] : [],
  );
}

/** 20, less what the best item or feature lowers it by: the lowest result stands rather than adding up. */
function critThreshold(
  bonuses: readonly ItemBonusTrait[],
  { critical }: Pick<FeatureStrike, "critical">,
): Breakdown<TermReference> {
  const best = bonuses.reduce<{ label: string; value: number } | undefined>(
    (lowest, item) =>
      item.critThreshold !== undefined && item.critThreshold < (lowest?.value ?? 20)
        ? { label: item.name, value: item.critThreshold }
        : lowest,
    critical,
  );
  return breakdown([
    { label: "Base", value: 20 },
    ...(best === undefined ? [] : [{ label: best.label, value: best.value - 20 }]),
  ]);
}

/** Each worn item's effect on scores, attuned where it must be, in inventory order. */
function equippedAbilityGrants(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): AbilityGrant[] {
  return definition.inventory.flatMap((entry) => {
    const item = catalog.itemAbilities.get(itemKey(entry));
    return item && entry.equipped && (entry.attuned || !item.requiresAttunement)
      ? [pickedGrant(item, entry.abilityPicks)]
      : [];
  });
}

/** Each inventory entry whose item offers a pick of scores that the entry has not fully made. */
function derivedPendingAbilityPicks(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): CharacterDerived["pendingAbilityPicks"] {
  return definition.inventory.flatMap((entry, index) => {
    const item = catalog.itemAbilities.get(itemKey(entry));
    const choose = item?.choose;
    if (!item || !choose || validPicks(item, entry.abilityPicks).length >= choose.count) return [];
    return [{ entry: index, from: [...choose.from], count: choose.count }];
  });
}

/**
 * One term per item that `pick` gives a nonzero number, labeled with the item's name. Items
 * naming one `stack` group add up to their `cap`, in inventory order: a member
 * past the cap is cut to what is left, and dropped when nothing is. Picks that feed one roll
 * share `taken`, so a group's cap holds across them.
 */
const itemTerms = (
  bonuses: readonly ItemBonusTrait[],
  pick: (item: ItemBonusTrait) => number,
  taken = new Map<string, number>(),
) => {
  return bonuses.flatMap((item) => {
    let value = pick(item);
    if (value !== 0 && item.stack) {
      const running = taken.get(item.stack.group) ?? 0;
      value = value > 0 ? Math.max(0, Math.min(value, item.stack.cap - running)) : value;
      taken.set(item.stack.group, running + value);
    }
    return value === 0 ? [] : [{ label: item.name, value }];
  });
};

/** Each worn item's armor class and save bonuses, attuned where it must be, in inventory order. */
function equippedBonuses(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): ItemBonusTrait[] {
  return definition.inventory.flatMap((entry) => {
    const item = catalog.itemBonuses.get(itemKey(entry));
    return item && entry.equipped && (entry.attuned || !item.requiresAttunement) ? [item] : [];
  });
}

const scoreOf = (definition: CharacterDefinition, catalog: CharacterCatalog, ability: Ability) =>
  abilityScore(definition, ability, equippedAbilityGrants(definition, catalog));

type Grant = DefenseTrait & { from: string };
type RageBenefits = ReturnType<typeof rageBenefits>;

/** Each name once, in the order first granted, with every label that grants it. */
function gathered(grants: readonly Grant[], names: (grant: Grant) => readonly string[]) {
  const from = new Map<string, string[]>();
  for (const grant of grants) {
    for (const name of names(grant)) {
      const labels = from.get(name) ?? [];
      if (!labels.includes(grant.from)) labels.push(grant.from);
      from.set(name, labels);
    }
  }
  return [...from].map(([name, labels]) => ({ name, from: labels }));
}

/**
 * The race's grants, its picked resistance among them, then each feat's and feature's, then
 * each equipped item's. An item that requires attunement grants only once it is attuned as well. A resistance
 * stays listed beside an immunity to the same type, since each names a source the reader
 * may want.
 */
function derivedDefenses(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  feats: readonly Grant[],
  names?: HomebrewNames,
): ComputedField<Defenses> {
  const { resistChoice, ...race } = catalog.raceDefenses;
  const from = raceSummary(definition, names);
  const pick = definition.raceResistance;
  const picked = pick !== undefined && resistChoice.includes(pick) ? pick : undefined;
  const grants: Grant[] = [
    { ...race, resist: picked ? [...race.resist, picked] : race.resist, from },
    ...feats,
  ];
  for (const entry of definition.inventory) {
    const item = catalog.itemDefenses.get(itemKey(entry));
    if (item && entry.equipped && (entry.attuned || !item.requiresAttunement)) {
      grants.push({ ...item, from: item.name });
    }
  }
  return computed({
    resistances: gathered(grants, (grant) => grant.resist),
    damageImmunities: gathered(grants, (grant) => grant.immune),
    vulnerabilities: gathered(grants, (grant) => grant.vulnerable),
    conditionImmunities: gathered(grants, (grant) => grant.conditionImmune),
    resistanceChoice:
      picked || resistChoice.length === 0 ? null : { from, options: [...resistChoice] },
  });
}

/**
 * The race's senses, then each feat's, then each equipped item's, attuned where it must be.
 * A sense two sources grant keeps the longer range and names both.
 */
function derivedSenses(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  feats: readonly (SenseGrant & { from: string; raceBonus?: number })[],
  names?: HomebrewNames,
): ComputedField<CharacterDerived["senses"]["computed"]> {
  const grants = [
    ...catalog.raceSenses.map((sense) => ({ ...sense, from: raceSummary(definition, names) })),
    ...feats.map(({ raceBonus, ...sense }) => {
      const race = catalog.raceSenses.find(({ name }) => name === sense.name);
      return race && raceBonus ? { ...sense, range: race.range + raceBonus } : sense;
    }),
  ];
  for (const entry of definition.inventory) {
    const item = catalog.itemSenses.get(itemKey(entry));
    if (item && entry.equipped && (entry.attuned || !item.requiresAttunement)) {
      grants.push(...item.senses.map((sense) => ({ ...sense, from: item.name })));
    }
  }
  return computed(
    SENSES.flatMap((name) => {
      const granting = grants.filter((grant) => grant.name === name);
      if (granting.length === 0) return [];
      return [
        {
          name,
          range: Math.max(...granting.map(({ range }) => range)),
          from: [...new Set(granting.map(({ from }) => from))],
        },
      ];
    }),
  );
}

/**
 * The proficiencies and languages equipped items grant, attuned where they must be, as the
 * entry's stored pick names them, and the entries still waiting on one. Upstream flags the
 * grant without naming it, so an item grants nothing until the pick is stored.
 */
function derivedItemGrants(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  skills: CharacterDerived["itemGrants"]["computed"]["skills"],
): CharacterDerived["itemGrants"] {
  const grants: CharacterDerived["itemGrants"]["computed"] = {
    skills,
    proficiencies: [],
    languages: [],
    pending: [],
  };
  definition.inventory.forEach((entry, index) => {
    const item = catalog.itemBonuses.get(itemKey(entry));
    if (!item || !entry.equipped || (item.requiresAttunement && !entry.attuned)) return;
    const from = item.name;
    if (item.grantsProficiency) {
      if (entry.proficiencyPick) grants.proficiencies.push({ name: entry.proficiencyPick, from });
      else grants.pending.push({ entry: index, item: from, kind: "proficiency" });
    }
    if (item.grantsLanguage) {
      if (entry.languagePick) grants.languages.push({ name: entry.languagePick.name, from });
      else grants.pending.push({ entry: index, item: from, kind: "language" });
    }
  });
  return computed(grants);
}

function wornBurdens(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): ArmorBurdenTrait[] {
  return definition.inventory.flatMap((entry) => {
    const item = catalog.armorBurdens.get(itemKey(entry));
    return item && entry.equipped && (entry.attuned || !item.requiresAttunement) ? [item] : [];
  });
}

/** The abilities whose checks, saves and attacks heavy encumbrance puts at disadvantage. */
const BURDENED_ABILITIES = ["str", "dex", "con"] as const;

/** The abilities whose checks, saves and attacks armor worn without proficiency puts at disadvantage. */
const UNPROFICIENT_ARMOR_ABILITIES = ["str", "dex"] as const;

const ROLLS = ["check", "save", "attack"] as const;

/** Disadvantage on every check, save and attack that uses one of `abilities`, cited to `source`. */
const disadvantageOn = (source: string, abilities: readonly Ability[]) =>
  ROLLS.flatMap((roll) =>
    abilities.map((target) => ({ source, mode: "disadvantage" as const, roll, target })),
  );

/**
 * The advantage and disadvantage of each equipped item, attuned where it must be, in
 * inventory order, then the Stealth disadvantage of worn armor, then the disadvantage of
 * armor worn without proficiency, then heavy encumbrance's where `burdened`, then `features`'.
 */
function derivedRollEffects(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  burdened: boolean,
  features: CharacterDerived["rollEffects"]["computed"],
): CharacterDerived["rollEffects"] {
  const granted = definition.inventory.flatMap((entry) => {
    const item = catalog.itemAdvantages.get(itemKey(entry));
    if (!item || !entry.equipped || (item.requiresAttunement && !entry.attuned)) return [];
    return item.effects.map((effect) => ({ source: item.name, ...effect }));
  });
  const stealth = wornBurdens(definition, catalog)
    .filter((armor) => armor.stealth)
    .map((armor) => ({
      source: armor.name,
      mode: "disadvantage" as const,
      roll: "skill" as const,
      target: "Stealth",
    }));
  const unproficient = unproficientArmorWorn(definition, catalog).flatMap((name) =>
    disadvantageOn(name, UNPROFICIENT_ARMOR_ABILITIES),
  );
  const encumbered = burdened ? disadvantageOn("Heavily encumbered", BURDENED_ABILITIES) : [];
  return computed([...granted, ...stealth, ...unproficient, ...encumbered, ...features]);
}

/** A class `hitDice` does not name is rejected the same way `hitPointMaximum` rejects it. */
function hitDicePools(
  definition: CharacterDefinition,
  hitDice: ReadonlyMap<string, HitDie>,
): CharacterDerived["hitDice"] {
  const totals = new Map<HitDie, number>();
  for (const level of definition.levels) {
    const key = entryKey(level.class);
    const die = hitDice.get(key);
    if (die === undefined) throw new RangeError(`No hit die for ${key}`);
    totals.set(die, (totals.get(die) ?? 0) + 1);
  }
  return [...totals].map(([die, total]) => ({
    die,
    total: { computed: total, manual: null, terms: [] },
  }));
}

const computed = <T>(value: T): ComputedField<T> => ({ computed: value, manual: null, terms: [] });

function preparedCount(
  preparation: Preparation,
  modifier: number,
  classLevel: number,
): ComputedField<number> {
  return computed(
    "printed" in preparation
      ? preparation.printed
      : preparedSpellCount(modifier, classLevel, preparation.rule),
  );
}

/** One entry per class that casts, in the order its levels were taken. */
function spellcastingEntries(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  characterLevel: number,
  bonuses: readonly ItemBonusTrait[],
  attackModifiers: readonly Term<TermReference>[],
): CharacterDerived["spellcasting"] {
  return classLevels(definition).flatMap((group) => {
    const key = entryKey(group.class);
    const ability = catalog.spellcastingAbilities.get(key);
    if (ability === undefined) return [];
    const modifier = abilityModifier(scoreOf(definition, catalog, ability));
    const preparation = catalog.casterTables.get(key)?.preparation;
    const dcTaken = new Map<string, number>();
    const attackTaken = new Map<string, number>();
    return [
      {
        class: group.class,
        ability,
        saveDc: fromBreakdown(
          spellSaveDc(ability, modifier, characterLevel, [
            ...itemTerms(bonuses, (item) => item.proficiencyBonus, dcTaken),
            ...itemTerms(bonuses, (item) => item.spellSaveDc, dcTaken),
          ]),
        ),
        attackBonus: fromBreakdown(
          spellAttackBonus(ability, modifier, characterLevel, [
            ...itemTerms(bonuses, (item) => item.proficiencyBonus, attackTaken),
            ...itemTerms(bonuses, (item) => item.spellAttack, attackTaken),
            ...attackModifiers,
          ]),
        ),
        ...(preparation && { preparedSpells: preparedCount(preparation, modifier, group.level) }),
      },
    ];
  });
}

type CastingClass = {
  level: number;
  progression: CasterProgression;
  slots: readonly SpellSlotTotal[];
};

/** Every class that casts now and has a slot table, with its level in that class. */
function castingClasses(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): CastingClass[] {
  return classLevels(definition).flatMap((group) => {
    const key = entryKey(group.class);
    const table = catalog.casterTables.get(key);
    if (!catalog.spellcastingAbilities.has(key) || !table) return [];
    return [{ level: group.level, progression: table.progression, slots: table.slots }];
  });
}

/**
 * A class casting alone keeps its own table; two or more read the multiclass table.
 * Both editions state the rule, and it matters: a level 5 paladin's own table gives four
 * 1st-level slots and two 2nd, where the multiclass table at caster level 2 gives three.
 */
function slotTotals(casters: readonly CastingClass[]): CharacterDerived["spellSlots"] {
  const slotted = casters.filter((caster) => caster.progression !== "pact");
  const slots =
    slotted.length === 1
      ? (slotted[0]?.slots ?? [])
      : multiclassSlots(multiclassCasterLevel(slotted));
  return slots.map((slot) => ({ level: slot.level, total: computed(slot.total) }));
}

/** A pact table prints one slot level per class level, so its row is a single entry. */
function pactSlots(casters: readonly CastingClass[]): CharacterDerived["pactSlots"] {
  const slot = casters.find((caster) => caster.progression === "pact")?.slots[0];
  return slot ? { level: slot.level, total: computed(slot.total) } : null;
}

/**
 * The whole derived block for one character: every value `characterDerivedSchema`
 * holds, assembled from the definition and the catalog facts the caller resolved for
 * it, with the definition's `overrides` folded into each `manual`. A held reduction to the hit
 * point maximum lowers its override as well as its computed total. Every number reads the
 * proficiencies together with what feats grant.
 */
export function deriveCharacter(
  stored: CharacterDefinition,
  catalog: CharacterCatalog,
  state: Pick<CharacterState, "activeEffects" | "hitPointMaximumReduction" | "temporaryModifiers"> &
    Partial<Pick<CharacterState, "conditions" | "exhaustion">> = {
    activeEffects: [],
    hitPointMaximumReduction: null,
    temporaryModifiers: [],
  },
  names?: HomebrewNames,
): CharacterDerived {
  const feats = featGrants(stored, catalog);
  const definition = withFeatGrants(stored, feats.granted, feats.itemSkills);
  const level = totalLevel(definition);
  const armorWorn = equippedArmor(definition, catalog.armor).worn?.category;
  const heavyArmorWorn = armorWorn === "heavy";
  const rage = rageBenefits(definition, catalog, state, heavyArmorWorn);
  const casters = castingClasses(definition, catalog);
  const grants = equippedAbilityGrants(definition, catalog);
  const bonuses = equippedBonuses(definition, catalog);

  const worn = wornBurdens(definition, catalog);
  const featSpeed = speedWithFeats(catalog.speed, definition, armorWorn);
  const { worn: bodyArmor, shield: heldShield } = equippedArmor(definition, catalog.armor);
  const movement = speedWithUnarmoredMovement(
    featSpeed.speed,
    definition,
    bodyArmor !== undefined || heldShield !== undefined,
  );
  const itemSpeed = speedWithItems(movement.speed, bonuses);
  const armorSpeed = speedUnderArmor(itemSpeed.speed, worn, scoreOf(definition, catalog, "str"));
  const matchedSpeed = speedMatchingWalk(armorSpeed.speed, featSpeed.matches);
  const modifiedSpeed = speedWithModifiers(matchedSpeed.speed, state);
  const restrained = speedWithConditions(modifiedSpeed.speed, state.conditions ?? []);
  const speed = {
    speed: restrained.speed,
    terms: [
      ...featSpeed.terms,
      ...movement.terms,
      ...itemSpeed.terms,
      ...armorSpeed.terms,
      ...matchedSpeed.terms,
      ...modifiedSpeed.terms,
      ...restrained.terms,
    ],
  };
  const exhaustion = exhaustionPenaltyTerms(state.exhaustion ?? 0, exhaustionRuleset(definition));
  const attackModifiers = [...modifierTerms(state, onKind("attackRolls")), ...exhaustion];
  const rolls = featureRolls(
    definition,
    (ability) => abilityModifier(abilityScore(definition, ability, grants)),
    rage !== null,
  );
  const savingThrows = Object.fromEntries(
    ABILITIES.map((ability) => {
      const { total, terms } = savingThrowModifier(
        definition,
        ability,
        grants,
        [
          ...itemTerms(bonuses, (item) => item.save),
          ...modifierTerms(state, onSave(ability)),
          ...rollBonusTerms(rolls.bonuses, { roll: "save", ability }),
          ...exhaustion,
        ],
        bonuses,
      );
      return [ability, { computed: total, manual: null, terms }];
    }),
  ) as Record<Ability, ComputedField<number>>;

  const concentrationTaken = new Map<string, number>();
  // Seeds the caps with the Con save terms that this roll already includes.
  itemTerms(bonuses, (item) => item.save, concentrationTaken);
  const concentration = itemTerms(bonuses, (item) => item.concentration, concentrationTaken);
  const concentrationSave =
    concentration.length === 0
      ? null
      : fromBreakdown(breakdown([...savingThrows.con.terms, ...concentration]));

  const spellDamage = itemTerms(bonuses, (item) => item.spellDamage);
  const spellDamageBonus = spellDamage.length === 0 ? null : fromBreakdown(breakdown(spellDamage));

  const checkBonus = [
    ...itemTerms(bonuses, (item) => item.abilityCheck),
    ...modifierTerms(state, onKind("check")),
  ];
  const proficiencyBonus = breakdown<TermReference>([
    ...proficiencyBonusBreakdown<TermReference>(level).terms,
    ...itemTerms(bonuses, (item) => item.proficiencyBonus),
  ]);
  const halfProficient = (ability: Ability) => {
    const term = halfProficiencyTerm(definition, ability, proficiencyBonus.total);
    return term ? [term] : [];
  };
  const skills = catalog.skills.map((skill) => {
    const unproficient = !definition.proficiencies.skills.some(
      (held) => refKey(held.ref) === refKey(skill.ref) && held.level !== "none",
    );
    const skillBonus = [
      ...checkBonus,
      ...modifierTerms(state, onSkill(skill.ref)),
      ...rollBonusTerms(rolls.bonuses, { roll: "skill", skill: skill.ref.name }),
      ...(unproficient && skill.ability !== "flat" ? halfProficient(skill.ability) : []),
    ];
    const { total, terms } = skillModifier(
      definition,
      skill.ref,
      skill.ability,
      grants,
      [...skillBonus, ...exhaustion],
      bonuses,
    );
    return {
      ref: skill.ref,
      ability: skill.ability === "flat" ? null : skill.ability,
      modifier: { computed: total, manual: null, terms },
      passive: {
        computed: passiveSkill(definition, skill.ref, skill.ability, grants, skillBonus, bonuses),
        manual: null,
        terms: [],
      },
    };
  });

  const scores = Object.fromEntries(
    ABILITIES.map((ability) => [ability, abilityScoreBreakdown(definition, ability, grants)]),
  ) as Record<Ability, Breakdown<TermReference>>;
  const perAbility = (field: (ability: Ability) => ComputedField<number>) =>
    Object.fromEntries(ABILITIES.map((ability) => [ability, field(ability)])) as Record<
      Ability,
      ComputedField<number>
    >;

  const { burdened, ...carrying } = load(definition, catalog);
  const abilityCheck = (ability: Ability, modifier: number) =>
    fromBreakdown(
      breakdown<TermReference>([
        { label: "Ability modifier", value: modifier },
        ...halfProficient(ability),
        ...exhaustion,
      ]),
    );
  const block: CharacterDerived = {
    abilityScores: perAbility((ability) => fromBreakdown(scores[ability])),
    abilityModifiers: perAbility((ability) =>
      fromBreakdown(abilityModifierBreakdown(scores[ability].total)),
    ),
    abilityChecks: perAbility((ability) =>
      abilityCheck(ability, abilityModifier(scores[ability].total)),
    ),
    hitPointMaximum: fromBreakdown(
      reducedMaximum(
        withModifiers(
          exhaustedMaximum(
            hitPointMaximum(definition, catalog.hitDice, grants),
            state.exhaustion ?? 0,
            exhaustionRuleset(definition),
          ),
          modifierTerms(state, onKind("hitPointMaximum")).map((term) => ({
            ...term,
            reference: MODIFIER_REFERENCE,
          })),
        ),
        state.hitPointMaximumReduction,
      ),
    ),
    hitDice: hitDicePools(definition, catalog.hitDice),
    size: { computed: raceSize(definition, catalog), manual: null, terms: [] },
    speed: { computed: speed.speed, manual: null, terms: speed.terms },
    proficiencyBonus: fromBreakdown(proficiencyBonus),
    savingThrows,
    concentrationSave,
    skills,
    armorClass: derivedArmorClass(definition, catalog, modifierTerms(state, onKind("armorClass"))),
    initiative: fromBreakdown(
      breakdown([
        ...abilityModifierBreakdown<TermReference>(scores.dex.total).terms,
        ...checkBonus,
        ...exhaustion,
        ...featInitiativeTerms(definition, proficiencyBonus.total),
        ...(initiativeUsesProficiency(definition) ? [] : halfProficient("dex")),
        ...subclassInitiativeTerms(
          definition,
          (ability) => abilityModifier(scores[ability].total),
          proficiencyBonus.total,
        ),
      ]),
    ),
    spellcasting: spellcastingEntries(definition, catalog, level, bonuses, attackModifiers),
    spellDamageBonus,
    spellSlots: slotTotals(casters),
    pactSlots: pactSlots(casters),
    classResources: classResourcePools(definition, catalog, bonuses),
    ...carrying,
    attunementSlots: computed(attunementSlots(artificerLevel(definition))),
    weaponMasteryLimit: fromBreakdown(weaponMasteryLimit(definition, catalog)),
    attacks: derivedAttacks(definition, catalog, bonuses, rage, attackModifiers),
    offHandAttack: derivedOffHandAttack(definition, catalog, bonuses, rage, attackModifiers),
    unarmedStrike: derivedUnarmedStrike(definition, catalog, bonuses, rage, attackModifiers),
    defenses: derivedDefenses(
      definition,
      catalog,
      feats.defenses.filter(({ whileRaging }) => !whileRaging || rage),
      names,
    ),
    senses: derivedSenses(definition, catalog, feats.senses, names),
    itemGrants: derivedItemGrants(definition, catalog, feats.itemSkills),
    featGrants: computed(feats.granted),
    rollEffects: derivedRollEffects(definition, catalog, burdened, [
      ...rolls.effects,
      ...featureAttackEffects(definition),
    ]),
    rollOptions: computed(rolls.options),
    featureRestores: featureRestores(definition, {
      column: tableColumn(definition, catalog),
      modifier: (ability) => abilityModifier(scores[ability].total),
    }),
    limitedUses: featureLimitedUses(definition, (ability) =>
      abilityModifier(scores[ability].total),
    ),
    unproficientItems: derivedUnproficientItems(definition, catalog),
    pendingAbilityPicks: derivedPendingAbilityPicks(definition, catalog),
    castingBlockedBy: unproficientArmorWorn(definition, catalog),
    heavyArmorWorn,
  };
  const modifiers = applyOverrides(block, stored).abilityModifiers;
  const folded = applyOverrides(
    {
      ...block,
      abilityChecks: perAbility((ability) =>
        abilityCheck(ability, modifiers[ability].manual ?? modifiers[ability].computed),
      ),
    },
    stored,
  );
  return {
    ...folded,
    hitPointMaximum: reducedOverride(folded.hitPointMaximum, state.hitPointMaximumReduction),
  };
}

/** The definition's pick where the race offers it, otherwise the largest size it offers. */
function raceSize(definition: CharacterDefinition, catalog: CharacterCatalog): Size {
  const chosen = definition.size;
  if (chosen !== undefined && catalog.sizes.includes(chosen)) return chosen;
  return catalog.sizes.reduce((largest, next) =>
    SIZES.indexOf(next) > SIZES.indexOf(largest) ? next : largest,
  );
}

function load(definition: CharacterDefinition, catalog: CharacterCatalog) {
  const strength = scoreOf(definition, catalog, "str");
  const size = raceSize(definition, catalog);
  const weight = carriedWeight(definition, catalog.weights, catalog.containers);
  const overflows = containerOverflows(definition, catalog.weights, catalog.containers);
  const penalty = houseRule(definition, "encumbrance")
    ? encumbranceAt(strength, size, weight)
    : null;
  return {
    carryingCapacity: computed(carryingCapacity(strength, size)),
    carriedWeight: weight,
    containers: definition.inventory.flatMap((entry, index) => {
      const trait = catalog.containers.get(itemKey(entry));
      if (!trait) return [];
      const overflow = overflows
        .filter((over) => over.entry === index)
        .map(({ excess, unit }) => ({ excess, unit }));
      return [{ entry: index, name: trait.name, overflow }];
    }),
    // The tier and its disadvantage read the computed Strength and size rather than the
    // block, so an override of the capacity or the size leaves them standing, while the
    // Speed tile reduces by the overridden size. The way out is thresholds read from the
    // overridden capacity and size, once overrides fold into the block.
    encumbrance: penalty?.tier ?? null,
    burdened: penalty?.disadvantage ?? false,
  };
}

/**
 * Levels in a catalog class named `Artificer`, the name both editions' rows carry. A
 * homebrew class carries only an id here, so a homebrew artificer counts no levels and
 * keeps three slots until a user overrides them.
 */
const artificerLevel = (definition: CharacterDefinition): number =>
  definition.levels.filter(({ class: ref }) => !("homebrewId" in ref) && ref.name === "Artificer")
    .length;
