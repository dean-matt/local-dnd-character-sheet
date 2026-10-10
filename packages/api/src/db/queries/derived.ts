/**
 * Resolves the `CharacterCatalog` `deriveCharacter` takes for one definition, reading
 * `content.db` for a catalog reference and `homebrew.db` for a homebrew one.
 *
 * A casting ability that resolves to nothing is left out, which `deriveCharacter` reads as
 * no spellcasting; an item that resolves to nothing adds no armor and weighs nothing. A
 * class or a race has no such reading — a guessed hit die invents hit points, and a
 * guessed size moves carrying capacity — so either one missing throws
 * `UnresolvedReference`.
 */

import {
  abilityGrantSchema,
  armorBurdenSchema,
  armorTraitSchema,
  casterProgressionSchema,
  castingStartLevelSchema,
  containerTraitSchema,
  defenseTraitSchema,
  itemAdvantageSchema,
  itemAdvantagesOf,
  itemBonusSchema,
  type PreparedSpellCount,
  preparationRuleSchema,
  raceTraitsSchema,
  spellcastingAbilitySchema,
  weaponTraitSchema,
} from "@dnd/catalog";
import {
  type Ability,
  type ArmorBurdenTrait,
  type ArmorTrait,
  type CasterTable,
  type CharacterCatalog,
  type CharacterDefinition,
  type ContainerTrait,
  type ContentRef,
  type DefenseTrait,
  type EntryRef,
  entryKey,
  type ItemAbilityTrait,
  type ItemAdvantageTrait,
  type ItemBonusTrait,
  type ItemDefenseTrait,
  itemKey,
  type Preparation,
  type SkillTrait,
  type WeaponTrait,
} from "@dnd/character";
import { ABILITIES, HIT_DICE, type HitDie } from "@dnd/rules";
import { type ZodType, z } from "zod";
import {
  getCasterRows,
  getClass,
  getFirstSpellSlotLevel,
  getSubclass,
  getWeaponMasteryCount,
} from "./classes.ts";
import { getHomebrewClass, getHomebrewRace, type HomebrewDb } from "./homebrew.ts";
import { type ItemFacts, itemWeights, resolveItemRows } from "./inventory.ts";
import { getBaseItemMasteries } from "./items.ts";
import { getRace, getSubrace } from "./races.ts";
import { listSkills } from "./skills.ts";

/** A class or race reference no catalog row or homebrew row answers. */
export class UnresolvedReference extends Error {
  override name = "UnresolvedReference";
}

const describe = (ref: EntryRef): string =>
  "homebrewId" in ref ? `homebrew ${ref.homebrewId}` : `${ref.name} (${ref.source})`;

/** A `json` column parsed against `schema`, `undefined` where either step fails. */
export function parseJson<T>(schema: ZodType<T>, json: unknown): T | undefined {
  const value = typeof json === "string" ? JSON.parse(json) : json;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

const isHitDie = (faces: number): faces is HitDie =>
  (HIT_DICE as readonly number[]).includes(faces);

const isAbility = (value: string | null): value is Ability =>
  (ABILITIES as readonly (string | null)[]).includes(value);

type ClassFacts = { hitDie: number; json: unknown };

function classFacts(
  dataDir: string,
  homebrewDb: HomebrewDb,
  ref: EntryRef,
): ClassFacts | undefined {
  if ("homebrewId" in ref) return getHomebrewClass(homebrewDb, ref.homebrewId);
  const row = getClass(dataDir, ref.name, ref.source);
  return row && { hitDie: row.hit_die, json: row.json };
}

/**
 * The class's own casting ability from its first spell slot, else the subclass's from the
 * lowest class level its `additionalSpells` names. Paladin (PHB) casts from 2nd level and
 * Path of the Ancestral Guardian from 10th. Only a catalog class has a table or a subclass
 * row to read, so a homebrew class casts from 1st. A subclass listing no spells counts
 * from the level it is taken, which holds for Way of the Four Elements but would show a
 * save DC early for one that casts later without listing its spells.
 */
function castingAbility(
  dataDir: string,
  definition: CharacterDefinition,
  ref: EntryRef,
  classJson: unknown,
): Ability | undefined {
  const own = parseJson(spellcastingAbilitySchema, classJson);
  if ("homebrewId" in ref) return own;
  const key = entryKey(ref);
  const classLevels = definition.levels.filter((level) => entryKey(level.class) === key);
  if (own !== undefined) {
    const start = getFirstSpellSlotLevel(dataDir, ref.name, ref.source) ?? 1;
    return classLevels.length < start ? undefined : own;
  }
  const subclass = classLevels.find((level) => level.subclass)?.subclass;
  if (!subclass) return undefined;
  const row = getSubclass(dataDir, subclass.name, subclass.source, ref.name, ref.source);
  if (!row) return undefined;
  const start = parseJson(castingStartLevelSchema, row.json);
  if (start !== undefined && classLevels.length < start) return undefined;
  return parseJson(spellcastingAbilitySchema, row.json);
}

const printedPreparation = (count: PreparedSpellCount): Preparation | undefined =>
  count.prepares ? { printed: count.count } : undefined;

const slotTotals = (rows: { slot_level: number; slots: number }[]) =>
  rows.map((row) => ({ level: row.slot_level, total: row.slots }));

/**
 * The table a catalog class casts from at the character's level in it: its own, else its
 * subclass's where a third caster such as the Eldritch Knight states one. A homebrew
 * class has no table to read, so it gets a save DC and no slots.
 */
function casterTable(
  dataDir: string,
  definition: CharacterDefinition,
  ref: EntryRef,
  classJson: unknown,
): CasterTable | undefined {
  if ("homebrewId" in ref) return undefined;
  const key = entryKey(ref);
  const classLevels = definition.levels.filter((level) => entryKey(level.class) === key);
  const subclass = classLevels.find((entry) => entry.subclass)?.subclass;
  const rows = getCasterRows(dataDir, ref, subclass, classLevels.length);
  const rule = parseJson(preparationRuleSchema, classJson);
  const prepares = rule ? { rule } : printedPreparation(rows.prepared);
  const withPreparation = (table: CasterTable, preparation = prepares): CasterTable =>
    preparation ? { ...table, preparation } : table;

  const own = parseJson(casterProgressionSchema, classJson);
  if (own) return withPreparation({ progression: own, slots: slotTotals(rows.slots) });
  const progression = rows.subclass && parseJson(casterProgressionSchema, rows.subclass.json);
  if (rows.subclass && progression) {
    return withPreparation(
      { progression, slots: slotTotals(rows.subclass.slots) },
      prepares ?? printedPreparation(rows.subclass.prepared),
    );
  }
  return undefined;
}

export function raceJson(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): unknown {
  const { race, subrace } = definition;
  if ("homebrewId" in race) return getHomebrewRace(homebrewDb, race.homebrewId)?.json;
  if (subrace)
    return getSubrace(dataDir, subrace.name, subrace.source, race.name, race.source)?.json;
  return getRace(dataDir, race.name, race.source)?.json;
}

/**
 * Only equipped entries, since nothing else reaches armor class. The map is keyed by the
 * base item, as `deriveCharacter` reads it, so a base equipped twice under two different
 * magic variants keeps the last one's bonus — the same last-one-wins rule it applies to
 * two suits of armor. The way out is keying armor by the inventory entry.
 */
function armorTraits(
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, ArmorTrait> {
  const armor = new Map<string, ArmorTrait>();
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    if (!entry.equipped || !row) return;
    const trait = parseJson(armorTraitSchema, row.json);
    if (trait) armor.set(entryKey(entry.ref), trait);
  });
  return armor;
}

/** A `{@itemMastery}` reference as an item writes it, `Topple|XPHB`, which is always the 2024 book's. */
function masteryRef(uid: string): ContentRef {
  const [name = uid, source = "XPHB"] = uid.split("|");
  return { name, source };
}

/** The `baseItem` uid a row names, lowercase as upstream writes it, in a list that is empty for none. */
function baseUid(row: ItemFacts): string[] {
  const uid = row.json.baseItem;
  return typeof uid === "string" ? [uid.toLowerCase()] : [];
}

/**
 * Every entry whose row states a weapon, keyed by `itemKey`. A proficiency names the base
 * weapon, so a named magic item answers to the `baseItem` it states and a magic variant to
 * its base item's name. A magic bonus traces to the variant that grants it, or to the row
 * itself; a homebrew row has no `(name, source)` to trace to. A magic item that states no
 * mastery takes its base item's.
 */
function weaponTraits(
  dataDir: string,
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, WeaponTrait> {
  const weapons = new Map<string, WeaponTrait>();
  const traits = rows.map((row) => (row ? parseJson(weaponTraitSchema, row.json) : undefined));
  const inherited = getBaseItemMasteries(
    dataDir,
    rows.flatMap((row, index) => {
      const trait = traits[index];
      return row && trait && !trait.mastery ? baseUid(row) : [];
    }),
  );
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    const trait = traits[index];
    if (!row || !trait) return;
    const mastery = (trait.mastery ?? inherited.get(baseUid(row)[0] ?? "") ?? []).map(masteryRef);
    const { ref, variant } = entry;
    const catalog = "homebrewId" in ref ? undefined : ref;
    const reference = variant ?? catalog;
    weapons.set(itemKey(entry), {
      kind: trait.kind,
      ...(trait.properties && { properties: trait.properties }),
      ...(trait.damage && { damage: trait.damage.dice }),
      ...(trait.versatileDamage && { versatileDamage: trait.versatileDamage }),
      ...(mastery.length > 0 && { mastery }),
      name: trait.baseName ?? catalog?.name ?? row.name,
      category: trait.category,
      damageType: trait.damage?.type ?? null,
      bonus: { ...trait.bonus, ...(reference && { reference }) },
    });
  });
  return weapons;
}

const grantsAny = (trait: DefenseTrait) =>
  trait.resist.length +
    trait.immune.length +
    trait.conditionImmune.length +
    trait.vulnerable.length >
  0;

const raceDefenses = (json: unknown) =>
  parseJson(defenseTraitSchema, json) ?? {
    resist: [],
    resistChoice: [],
    immune: [],
    conditionImmune: [],
    vulnerable: [],
  };

/** Every entry whose row grants a resistance, an immunity or a vulnerability, keyed by `itemKey`. */
function itemDefenses(
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, ItemDefenseTrait> {
  const defenses = new Map<string, ItemDefenseTrait>();
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    const trait = row && parseJson(defenseTraitSchema, row.json);
    if (!trait || !grantsAny(trait)) return;
    defenses.set(itemKey(entry), {
      resist: trait.resist,
      immune: trait.immune,
      conditionImmune: trait.conditionImmune,
      vulnerable: trait.vulnerable,
      name: row.name,
      requiresAttunement: row.requiresAttunement,
    });
  });
  return defenses;
}

/** Every entry whose row sets or raises a score, keyed by `itemKey`. */
function itemAbilities(
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, ItemAbilityTrait> {
  const abilities = new Map<string, ItemAbilityTrait>();
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    const grant = row && parseJson(abilityGrantSchema, row.json);
    if (!grant) return;
    abilities.set(itemKey(entry), {
      ...grant,
      name: row.name,
      requiresAttunement: row.requiresAttunement,
    });
  });
  return abilities;
}

/** Every entry whose row adds a bonus or changes a trait, keyed by `itemKey`. */
function itemBonuses(
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, ItemBonusTrait> {
  const bonuses = new Map<string, ItemBonusTrait>();
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    const bonus = row && parseJson(itemBonusSchema, row.json);
    if (!bonus) return;
    bonuses.set(itemKey(entry), {
      ...bonus,
      name: row.name,
      requiresAttunement: row.requiresAttunement,
    });
  });
  return bonuses;
}

/** Every entry whose row states a Stealth penalty or a Strength requirement, keyed by `itemKey`. */
function armorBurdens(
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, ArmorBurdenTrait> {
  const burdens = new Map<string, ArmorBurdenTrait>();
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    const burden = row && parseJson(armorBurdenSchema, row.json);
    if (!burden) return;
    burdens.set(itemKey(entry), {
      ...burden,
      name: row.name,
      requiresAttunement: row.requiresAttunement,
    });
  });
  return burdens;
}

/** Every entry whose row states a container capacity, keyed by `itemKey`. */
function containers(
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, ContainerTrait> {
  const held = new Map<string, ContainerTrait>();
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    const trait = row && parseJson(containerTraitSchema, row.json);
    if (trait) held.set(itemKey(entry), { ...trait, name: row.name });
  });
  return held;
}

const advantageListSchema = z.array(itemAdvantageSchema);

/**
 * Every entry whose item grants advantage or disadvantage, keyed by `itemKey`. A catalog
 * entry reads the mapping under its magic variant when it names one, since the variant is
 * where the effect comes from, and under the item itself otherwise; a homebrew item states
 * its own.
 */
function itemAdvantages(
  definition: CharacterDefinition,
  rows: readonly (ItemFacts | undefined)[],
): Map<string, ItemAdvantageTrait> {
  const advantages = new Map<string, ItemAdvantageTrait>();
  definition.inventory.forEach((entry, index) => {
    const row = rows[index];
    if (!row) return;
    const catalog = "homebrewId" in entry.ref ? undefined : (entry.variant ?? entry.ref);
    const effects = catalog
      ? itemAdvantagesOf(catalog.name, catalog.source)
      : parseJson(advantageListSchema, row.json.advantage);
    if (!effects?.length) return;
    advantages.set(itemKey(entry), {
      name: row.name,
      requiresAttunement: row.requiresAttunement,
      effects,
    });
  });
  return advantages;
}

/** Per catalog class, how many kinds of weapon its Weapon Mastery allows at the character's level in it. */
function weaponMasteryKinds(dataDir: string, definition: CharacterDefinition): Map<string, number> {
  const kinds = new Map<string, number>();
  const seen = new Set<string>();
  for (const { class: ref } of definition.levels) {
    const key = entryKey(ref);
    if ("homebrewId" in ref || seen.has(key)) continue;
    seen.add(key);
    const level = definition.levels.filter((each) => entryKey(each.class) === key).length;
    const count = getWeaponMasteryCount(dataDir, ref.name, ref.source, level);
    if (count > 0) kinds.set(key, count);
  }
  return kinds;
}

export function resolveCharacterCatalog(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterCatalog {
  const hitDice = new Map<string, HitDie>();
  const spellcastingAbilities = new Map<string, Ability>();
  const casterTables = new Map<string, CasterTable>();
  for (const { class: ref } of definition.levels) {
    const key = entryKey(ref);
    if (hitDice.has(key)) continue;
    const facts = classFacts(dataDir, homebrewDb, ref);
    if (!facts) throw new UnresolvedReference(`No class ${describe(ref)}`);
    if (!isHitDie(facts.hitDie)) {
      throw new UnresolvedReference(`Class ${describe(ref)} has a d${facts.hitDie} hit die`);
    }
    hitDice.set(key, facts.hitDie);
    const ability = castingAbility(dataDir, definition, ref, facts.json);
    if (!ability) continue;
    spellcastingAbilities.set(key, ability);
    const table = casterTable(dataDir, definition, ref, facts.json);
    if (table) casterTables.set(key, table);
  }

  const json = raceJson(dataDir, homebrewDb, definition);
  if (json === undefined)
    throw new UnresolvedReference(`No race ${describe(definition.subrace ?? definition.race)}`);
  const race = parseJson(raceTraitsSchema, json);
  if (!race)
    throw new UnresolvedReference(
      `Race ${describe(definition.subrace ?? definition.race)} states no size or speed`,
    );

  const skills: SkillTrait[] = listSkills(dataDir, definition.edition).flatMap((row) =>
    isAbility(row.ability)
      ? [{ ref: { name: row.name, source: row.source }, ability: row.ability }]
      : [],
  );

  const items = resolveItemRows(dataDir, homebrewDb, definition.inventory);
  return {
    hitDice,
    weaponMasteryKinds: weaponMasteryKinds(dataDir, definition),
    spellcastingAbilities,
    casterTables,
    skills,
    sizes: race.sizes,
    speed: race.speed,
    armor: armorTraits(definition, items),
    weights: itemWeights(definition.inventory, items),
    weapons: weaponTraits(dataDir, definition, items),
    raceDefenses: raceDefenses(json),
    itemDefenses: itemDefenses(definition, items),
    itemAbilities: itemAbilities(definition, items),
    itemBonuses: itemBonuses(definition, items),
    itemAdvantages: itemAdvantages(definition, items),
    armorBurdens: armorBurdens(definition, items),
    containers: containers(definition, items),
  };
}
