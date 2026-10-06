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
import type {
  ArmorTrait,
  CharacterCatalog,
  DefenseTrait,
  Preparation,
  WeaponTrait,
} from "./catalog.ts";
import type { CharacterDerived, Defenses } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { entryKey, itemKey, refKey } from "./keys.ts";
import { carriedWeight } from "./load.ts";
import { applyOverrides } from "./overrides.ts";
import type { Ability, ContentRef, EntryRef } from "./refs.ts";
import { houseRule } from "./resolve.ts";
import { classLevels, raceLabel, totalLevel } from "./summaries.ts";

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
): Breakdown<TermReference> {
  const levels = definition.levels.map((level) => {
    const key = entryKey(level.class);
    const die = hitDice.get(key);
    if (die === undefined) throw new RangeError(`No hit die for ${key}`);
    return { die, rolled: level.rolled };
  });
  return maxHitPoints(levels, abilityModifier(definition.abilityScores.con));
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
): number {
  const key = refKey(skill);
  const entry = definition.proficiencies.skills.find((held) => refKey(held.ref) === key);
  return passiveScore(
    abilityModifier(definition.abilityScores[ability]),
    proficiencyContribution(totalLevel(definition), entry?.level ?? "none"),
  );
}

/**
 * The check modifier for one skill: the ability modifier and whatever the character's
 * proficiency in that skill is worth. Companion to `passiveSkill`, which takes the same
 * inputs to the passive score instead.
 */
function skillModifier(
  definition: CharacterDefinition,
  skill: ContentRef,
  ability: Ability,
): Breakdown<TermReference> {
  const key = refKey(skill);
  const entry = definition.proficiencies.skills.find((held) => refKey(held.ref) === key);
  const contribution = proficiencyContribution(totalLevel(definition), entry?.level ?? "none");
  const terms: Term<TermReference>[] = [
    {
      label: ABILITY_LABEL[ability],
      value: abilityModifier(definition.abilityScores[ability]),
      reference: skill,
    },
  ];
  if (contribution !== 0) terms.push({ label: "Proficiency", value: contribution });
  return breakdown(terms);
}

/**
 * The saving throw modifier for one ability: its modifier, and proficiency where
 * `proficiencies.savingThrows` names it. Only the character's first class grants a
 * saving throw proficiency in 5e, so that choice is already resolved into this list
 * rather than read again from a class row here.
 */
function savingThrowModifier(
  definition: CharacterDefinition,
  ability: Ability,
): Breakdown<TermReference> {
  const proficient = definition.proficiencies.savingThrows.includes(ability);
  const contribution = proficiencyContribution(
    totalLevel(definition),
    proficient ? "proficient" : "none",
  );
  const terms: Term<TermReference>[] = [
    { label: ABILITY_LABEL[ability], value: abilityModifier(definition.abilityScores[ability]) },
  ];
  if (contribution !== 0) terms.push({ label: "Proficiency", value: contribution });
  return breakdown(terms);
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
  const { worn, shield } = equippedArmor(definition, catalog.armor);
  const result = armorClass<TermReference>({
    base: worn ? { value: worn.armorClass, reference: catalogReference(worn.ref) } : { value: 10 },
    dexterityModifier: { value: abilityModifier(definition.abilityScores.dex) },
    dexterityCap: worn ? DEXTERITY_CAP[worn.category] : "all",
    shield: shield
      ? { value: shield.armorClass, reference: catalogReference(shield.ref) }
      : undefined,
  });
  return { computed: result.total, manual: null, terms: result.terms };
}

/**
 * The typed form of a weapon or category name, folded so the spellings the book prints
 * (`Simple weapons`, `Longswords`) meet the bare ones (`Simple`, `Longsword`). Both sides
 * pass through it, so a name that ends in `s` still meets itself. Only these spellings fold
 * until a catalog picker writes `proficiencies.weapons`.
 */
function weaponKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+weapons?$/, "")
    .replace(/s$/, "");
}

/** A weapon proficiency names a category or one weapon: `Simple`, `Longsword`. */
function weaponProficient(definition: CharacterDefinition, weapon: WeaponTrait): boolean {
  const held = new Set(definition.proficiencies.weapons.map(weaponKey));
  return (
    (weapon.category !== null && held.has(weaponKey(weapon.category))) ||
    held.has(weaponKey(weapon.name))
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
): CharacterDerived["attacks"] {
  const shield = equippedArmor(definition, catalog.armor).shield !== undefined;
  const level = totalLevel(definition);
  return definition.inventory.flatMap((entry, index) => {
    const weapon = catalog.weapons.get(itemKey(entry));
    if (!entry.carried || weapon === undefined) return [];
    const twoHandedBlocked = entry.equipped && shield;
    const held = twoHandedBlocked ? "one-handed" : (entry.grip ?? "one-handed");
    const { reference } = weapon.bonus;
    const result = weaponAttack<TermReference>({
      weapon,
      strengthModifier: abilityModifier(definition.abilityScores.str),
      dexterityModifier: abilityModifier(definition.abilityScores.dex),
      proficiency: proficiencyContribution(
        level,
        weaponProficient(definition, weapon) ? "proficient" : "none",
      ),
      attackBonus: { value: weapon.bonus.attack, reference },
      damageBonus: { value: weapon.bonus.damage, reference },
      grip: held,
    });
    return [
      {
        entry: index,
        ability: result.ability,
        attackBonus: fromBreakdown(result.attack),
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
  const from = raceLabel(definition);
  const pick = definition.resistance;
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
    conditionImmunities: gathered(grants, (grant) => grant.conditionImmune),
    resistanceChoice:
      picked || resistChoice.length === 0 ? null : { from, options: [...resistChoice] },
  });
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
): CharacterDerived["spellcasting"] {
  return classLevels(definition).flatMap((group) => {
    const key = entryKey(group.class);
    const ability = catalog.spellcastingAbilities.get(key);
    if (ability === undefined) return [];
    const modifier = abilityModifier(definition.abilityScores[ability]);
    const preparation = catalog.casterTables.get(key)?.preparation;
    return [
      {
        class: group.class,
        ability,
        saveDc: fromBreakdown(spellSaveDc(ability, modifier, characterLevel)),
        attackBonus: fromBreakdown(spellAttackBonus(ability, modifier, characterLevel)),
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

  const savingThrows = Object.fromEntries(
    ABILITIES.map((ability) => {
      const { total, terms } = savingThrowModifier(definition, ability);
      return [ability, { computed: total, manual: null, terms }];
    }),
  ) as Record<Ability, ComputedField<number>>;

  const skills = catalog.skills.map((skill) => {
    const { total, terms } = skillModifier(definition, skill.ref, skill.ability);
    return {
      ref: skill.ref,
      ability: skill.ability,
      modifier: { computed: total, manual: null, terms },
      passive: {
        computed: passiveSkill(definition, skill.ref, skill.ability),
        manual: null,
        terms: [],
      },
    };
  });

  const abilityModifiers = Object.fromEntries(
    ABILITIES.map((ability): [Ability, ComputedField<number>] => [
      ability,
      fromBreakdown(abilityModifierBreakdown(definition.abilityScores[ability])),
    ]),
  ) as Record<Ability, ComputedField<number>>;

  const block: CharacterDerived = {
    abilityModifiers,
    hitPointMaximum: fromBreakdown(hitPointMaximum(definition, catalog.hitDice)),
    hitDice: hitDicePools(definition, catalog.hitDice),
    size: { computed: raceSize(definition, catalog), manual: null, terms: [] },
    speed: { computed: catalog.speed, manual: null, terms: [] },
    proficiencyBonus: fromBreakdown(proficiencyBonusBreakdown(level)),
    savingThrows,
    skills,
    armorClass: derivedArmorClass(definition, catalog),
    initiative: fromBreakdown(abilityModifierBreakdown(definition.abilityScores.dex)),
    spellcasting: spellcastingEntries(definition, catalog, level),
    spellSlots: slotTotals(casters),
    pactSlots: pactSlots(casters),
    ...load(definition, catalog),
    attunementSlots: computed(attunementSlots(artificerLevel(definition))),
    attacks: derivedAttacks(definition, catalog),
    defenses: derivedDefenses(definition, catalog),
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
  const strength = definition.abilityScores.str;
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
