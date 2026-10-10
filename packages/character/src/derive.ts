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
  maxHitPoints,
  multiclassCasterLevel,
  multiclassSlots,
  passiveScore,
  preparedSpellCount,
  proficiencyBonusBreakdown,
  proficiencyContribution,
  SIZES,
  type Size,
  type SpellSlotTotal,
  spellAttackBonus,
  spellSaveDc,
  type Term,
  weaponAttack,
} from "@dnd/rules";
import { type AbilityGrant, abilityScore, abilityScoreBreakdown } from "./abilityScore.ts";
import type {
  ArmorTrait,
  CharacterCatalog,
  DefenseTrait,
  ItemBonusTrait,
  Preparation,
  WeaponTrait,
} from "./catalog.ts";
import type { CharacterDerived, Defenses } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { type ProficiencyItem, proficiencyItemTerms, speedWithItems } from "./itemEffects.ts";
import { entryKey, itemKey, refKey } from "./keys.ts";
import { carriedWeight } from "./load.ts";
import { applyOverrides } from "./overrides.ts";
import type { Ability, ContentRef, EntryRef } from "./refs.ts";
import { houseRule } from "./resolve.ts";
import { classLevels, raceSummary, totalLevel } from "./summaries.ts";

/**
 * The hit point maximum for a stored character.
 *
 * `hitDice` maps a class to its die, keyed by `entryKey` — a class is catalog or
 * homebrew data a character references rather than copies. A class the map does not
 * name is rejected rather than defaulted, since a guessed die invents hit points.
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
    return { die, rolled: level.rolled };
  });
  return maxHitPoints(levels, abilityModifier(abilityScore(definition, "con", grants)));
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
  ability: Ability,
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
  ability: Ability,
  grants: readonly AbilityGrant[] = [],
  bonuses: readonly Term<TermReference>[] = [],
  proficiencyItems: readonly ProficiencyItem[] = [],
): Breakdown<TermReference> {
  const key = refKey(skill);
  const entry = definition.proficiencies.skills.find((held) => refKey(held.ref) === key);
  const level = totalLevel(definition);
  const proficiency = entry?.level ?? "none";
  const contribution = proficiencyContribution(level, proficiency);
  const terms: Term<TermReference>[] = [
    {
      label: ABILITY_LABEL[ability],
      value: abilityModifier(abilityScore(definition, ability, grants)),
      reference: skill,
    },
  ];
  if (contribution !== 0) terms.push({ label: "Proficiency", value: contribution });
  return breakdown([
    ...terms,
    ...proficiencyItemTerms(level, proficiency, proficiencyItems),
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

/** `undefined` for a homebrew ref: `TermReference` names only a catalog `(name, source)`. */
function catalogReference(ref: EntryRef): ContentRef | undefined {
  return "homebrewId" in ref ? undefined : ref;
}

type WornArmor = {
  category: Exclude<ArmorTrait["category"], "shield">;
  armorClass: number;
  ref: EntryRef;
};
type WornShield = { armorClass: number; ref: EntryRef };

/** The worn armor and the shield a character has equipped, last one of each wins. */
function equippedArmor(
  definition: CharacterDefinition,
  armor: ReadonlyMap<string, ArmorTrait>,
): { worn?: WornArmor; shield?: WornShield } {
  let worn: WornArmor | undefined;
  let shield: WornShield | undefined;
  for (const entry of definition.inventory) {
    if (!entry.equipped) continue;
    const trait = armor.get(entryKey(entry.ref));
    if (trait === undefined) continue;
    if (trait.category === "shield") {
      shield = { armorClass: trait.armorClass, ref: entry.ref };
    } else {
      worn = { category: trait.category, armorClass: trait.armorClass, ref: entry.ref };
    }
  }
  return { worn, shield };
}

/**
 * Armor class from whatever the character has equipped. An item `armor` does not name —
 * the reference no longer resolves, or nothing is equipped — degrades to the unarmored
 * base of 10 rather than throwing, since one missing suit of armor is not a reason to
 * refuse the rest of the sheet.
 *
 * Unarmored Defense, the formula a Barbarian or a Monk uses in place of 10, is not
 * modeled: no catalog field states one yet. The gap closes the day a class's own row
 * carries it; until then this reads the base as if no such feature exists.
 */
function derivedArmorClass(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): ComputedField<number> {
  const bonus = itemTerms(equippedBonuses(definition, catalog), (item) => item.ac);
  const { worn, shield } = equippedArmor(definition, catalog.armor);
  const result = armorClass<TermReference>({
    base: worn ? { value: worn.armorClass, reference: catalogReference(worn.ref) } : { value: 10 },
    dexterityModifier: { value: abilityModifier(scoreOf(definition, catalog, "dex")) },
    dexterityCap: worn ? DEXTERITY_CAP[worn.category] : "all",
    shield: shield
      ? { value: shield.armorClass, reference: catalogReference(shield.ref) }
      : undefined,
    bonus,
  });
  return { computed: result.total, manual: null, terms: result.terms };
}

/**
 * The typed form of an armor, weapon or category name, folded so the spellings the book
 * prints (`Simple weapons`, `Longswords`, `Heavy Armor`) meet the bare ones (`Simple`,
 * `Longsword`, `heavy`). Both sides pass through it, so a name that ends in `s` still
 * meets itself. Only these spellings fold until a catalog picker writes
 * `proficiencies.weapons`.
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
 * One attack per carried weapon. A shield counts only while equipped, as armor class reads
 * it. A second die is what makes a weapon versatile: every upstream row with a `dmg2`
 * carries the `V` property, and none carries `V` without one.
 */
function derivedAttacks(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  bonuses: readonly ItemBonusTrait[],
): CharacterDerived["attacks"] {
  const shield = equippedArmor(definition, catalog.armor).shield !== undefined;
  const level = totalLevel(definition);
  return definition.inventory.flatMap((entry, index) => {
    const weapon = catalog.weapons.get(itemKey(entry));
    if (!entry.carried || weapon === undefined) return [];
    const twoHandedBlocked = entry.equipped && shield;
    const held = twoHandedBlocked ? "one-handed" : (entry.grip ?? "one-handed");
    const { reference } = weapon.bonus;
    const proficiency = weaponProficient(definition, weapon) ? "proficient" : "none";
    const result = weaponAttack<TermReference>({
      weapon,
      strengthModifier: abilityModifier(scoreOf(definition, catalog, "str")),
      dexterityModifier: abilityModifier(scoreOf(definition, catalog, "dex")),
      proficiency: proficiencyContribution(level, proficiency),
      attackBonus: { value: weapon.bonus.attack, reference },
      damageBonus: { value: weapon.bonus.damage, reference },
      grip: held,
    });
    return [
      {
        entry: index,
        ability: result.ability,
        attackBonus: fromBreakdown(
          breakdown([...result.attack.terms, ...proficiencyItemTerms(level, proficiency, bonuses)]),
        ),
        critThreshold: fromBreakdown(critThreshold(critItems(definition, catalog, index))),
        damage: result.damage
          ? {
              dice: result.damage.dice,
              type: weapon.damageType,
              modifier: fromBreakdown(result.damage.modifier),
            }
          : null,
        grip: weapon.versatileDamage === undefined ? null : { held, twoHandedBlocked },
      },
    ];
  });
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

/** 20, less what the best item lowers it by: the lowest result stands rather than adding up. */
function critThreshold(bonuses: readonly ItemBonusTrait[]): Breakdown<TermReference> {
  const best = bonuses.reduce<ItemBonusTrait | undefined>(
    (lowest, item) =>
      item.critThreshold !== undefined && item.critThreshold < (lowest?.critThreshold ?? 20)
        ? item
        : lowest,
    undefined,
  );
  return breakdown([
    { label: "Base", value: 20 },
    ...(best?.critThreshold === undefined
      ? []
      : [{ label: best.name, value: best.critThreshold - 20 }]),
  ]);
}

/** Each worn item's effect on scores, attuned where it must be, in inventory order. */
function equippedAbilityGrants(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): AbilityGrant[] {
  return definition.inventory.flatMap((entry) => {
    const item = catalog.itemAbilities.get(itemKey(entry));
    return item && entry.equipped && (entry.attuned || !item.requiresAttunement) ? [item] : [];
  });
}

/** One term per item that `pick` gives a nonzero number, labeled with the item's name. */
const itemTerms = (bonuses: readonly ItemBonusTrait[], pick: (item: ItemBonusTrait) => number) =>
  bonuses
    .filter((item) => pick(item) !== 0)
    .map((item) => ({ label: item.name, value: pick(item) }));

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
 * The race's grants, its picked resistance among them, then each equipped item's. An
 * item that requires attunement grants only once it is attuned as well. A resistance
 * stays listed beside an immunity to the same type, since each names a source the reader
 * may want.
 */
function derivedDefenses(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): ComputedField<Defenses> {
  const { resistChoice, ...race } = catalog.raceDefenses;
  const from = raceSummary(definition);
  const pick = definition.raceResistance;
  const picked = pick !== undefined && resistChoice.includes(pick) ? pick : undefined;
  const grants: Grant[] = [
    { ...race, resist: picked ? [...race.resist, picked] : race.resist, from },
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

/** The equipped items, attuned where they must be, that grant a proficiency or a language. */
function derivedItemGrants(bonuses: readonly ItemBonusTrait[]): CharacterDerived["itemGrants"] {
  const named = (granted: (item: ItemBonusTrait) => boolean) =>
    bonuses.filter(granted).map((item) => item.name);
  return computed({
    proficiencies: named((item) => item.grantsProficiency),
    languages: named((item) => item.grantsLanguage),
  });
}

/** The advantage and disadvantage of each equipped item, attuned where it must be, in inventory order. */
function derivedRollEffects(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): CharacterDerived["rollEffects"] {
  return computed(
    definition.inventory.flatMap((entry) => {
      const item = catalog.itemAdvantages.get(itemKey(entry));
      if (!item || !entry.equipped || (item.requiresAttunement && !entry.attuned)) return [];
      return item.effects.map((effect) => ({ item: item.name, ...effect }));
    }),
  );
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
): CharacterDerived["spellcasting"] {
  return classLevels(definition).flatMap((group) => {
    const key = entryKey(group.class);
    const ability = catalog.spellcastingAbilities.get(key);
    if (ability === undefined) return [];
    const modifier = abilityModifier(scoreOf(definition, catalog, ability));
    const preparation = catalog.casterTables.get(key)?.preparation;
    return [
      {
        class: group.class,
        ability,
        saveDc: fromBreakdown(
          spellSaveDc(ability, modifier, characterLevel, [
            ...itemTerms(bonuses, (item) => item.proficiencyBonus),
            ...itemTerms(bonuses, (item) => item.spellSaveDc),
          ]),
        ),
        attackBonus: fromBreakdown(
          spellAttackBonus(ability, modifier, characterLevel, [
            ...itemTerms(bonuses, (item) => item.proficiencyBonus),
            ...itemTerms(bonuses, (item) => item.spellAttack),
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
 * it, with the definition's `overrides` folded into each `manual`.
 */
export function deriveCharacter(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): CharacterDerived {
  const level = totalLevel(definition);
  const casters = castingClasses(definition, catalog);
  const grants = equippedAbilityGrants(definition, catalog);
  const bonuses = equippedBonuses(definition, catalog);

  const speed = speedWithItems(catalog.speed, bonuses);
  const savingThrows = Object.fromEntries(
    ABILITIES.map((ability) => {
      const { total, terms } = savingThrowModifier(
        definition,
        ability,
        grants,
        itemTerms(bonuses, (item) => item.save),
        bonuses,
      );
      return [ability, { computed: total, manual: null, terms }];
    }),
  ) as Record<Ability, ComputedField<number>>;

  const concentration = itemTerms(bonuses, (item) => item.concentration);
  const concentrationSave =
    concentration.length === 0
      ? null
      : fromBreakdown(breakdown([...savingThrows.con.terms, ...concentration]));

  const spellDamage = itemTerms(bonuses, (item) => item.spellDamage);
  const spellDamageBonus = spellDamage.length === 0 ? null : fromBreakdown(breakdown(spellDamage));

  const checkBonus = itemTerms(bonuses, (item) => item.abilityCheck);
  const skills = catalog.skills.map((skill) => {
    const { total, terms } = skillModifier(
      definition,
      skill.ref,
      skill.ability,
      grants,
      checkBonus,
      bonuses,
    );
    return {
      ref: skill.ref,
      ability: skill.ability,
      modifier: { computed: total, manual: null, terms },
      passive: {
        computed: passiveSkill(definition, skill.ref, skill.ability, grants, checkBonus, bonuses),
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

  const block: CharacterDerived = {
    abilityScores: perAbility((ability) => fromBreakdown(scores[ability])),
    abilityModifiers: perAbility((ability) =>
      fromBreakdown(abilityModifierBreakdown(scores[ability].total)),
    ),
    hitPointMaximum: fromBreakdown(hitPointMaximum(definition, catalog.hitDice, grants)),
    hitDice: hitDicePools(definition, catalog.hitDice),
    size: { computed: raceSize(definition, catalog), manual: null, terms: [] },
    speed: { computed: speed.speed, manual: null, terms: speed.terms },
    proficiencyBonus: fromBreakdown(
      breakdown([
        ...proficiencyBonusBreakdown<TermReference>(level).terms,
        ...itemTerms(bonuses, (item) => item.proficiencyBonus),
      ]),
    ),
    savingThrows,
    concentrationSave,
    skills,
    armorClass: derivedArmorClass(definition, catalog),
    initiative: fromBreakdown(
      breakdown([
        ...abilityModifierBreakdown<TermReference>(scores.dex.total).terms,
        ...checkBonus,
      ]),
    ),
    spellcasting: spellcastingEntries(definition, catalog, level, bonuses),
    spellDamageBonus,
    spellSlots: slotTotals(casters),
    pactSlots: pactSlots(casters),
    ...load(definition, catalog),
    attunementSlots: computed(attunementSlots(artificerLevel(definition))),
    attacks: derivedAttacks(definition, catalog, bonuses),
    defenses: derivedDefenses(definition, catalog),
    itemGrants: derivedItemGrants(bonuses),
    rollEffects: derivedRollEffects(definition, catalog),
  };
  return applyOverrides(block, definition);
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
  const weight = carriedWeight(definition, catalog.weights);
  return {
    carryingCapacity: computed(carryingCapacity(strength, size)),
    carriedWeight: weight,
    // The tier reads Strength and size rather than `carryingCapacity`, so an override of
    // the capacity leaves it standing. The way out is thresholds scaled by the overridden
    // capacity, once overrides fold into the block.
    encumbrance: houseRule(definition, "encumbrance")
      ? encumbranceAt(strength, size, weight).tier
      : null,
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
