/**
 * Resolves the `CharacterCatalog` `deriveCharacter` takes for one definition, reading
 * `content.db` for a catalog reference and `homebrew.db` for a homebrew one.
 *
 * A casting ability that resolves to nothing is left out, which `deriveCharacter` reads as
 * no spellcasting; an item that resolves to nothing adds no armor and weighs nothing. A
 * class or a race has no such reading — a guessed hit die invents hit points, and a guessed size moves
 * carrying capacity — so either one missing throws `UnresolvedReference`.
 */

import {
  armorTraitSchema,
  casterProgressionSchema,
  castingStartLevelSchema,
  type PreparedSpellCount,
  preparationRuleSchema,
  raceTraitsSchema,
  spellcastingAbilitySchema,
} from "@dnd/catalog";
import {
  type Ability,
  type ArmorTrait,
  type CasterTable,
  type CharacterCatalog,
  type CharacterDefinition,
  type EntryRef,
  entryKey,
  type Preparation,
  type SkillTrait,
} from "@dnd/character";
import { ABILITIES, HIT_DICE, type HitDie } from "@dnd/rules";
import type { ZodType } from "zod";
import {
  getCasterRows,
  getClass,
  getFirstSpellSlotLevel,
  getRace,
  getSubclass,
  getSubrace,
  listSkills,
} from "./content.ts";
import { getHomebrewClass, getHomebrewRace, type HomebrewDb } from "./homebrew.ts";
import { type ItemFacts, itemWeights, resolveItemRows } from "./inventory.ts";

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
    spellcastingAbilities,
    casterTables,
    skills,
    size: race.size,
    speed: race.speed,
    armor: armorTraits(definition, items),
    weights: itemWeights(definition.inventory, items),
  };
}
