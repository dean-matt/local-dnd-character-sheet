/**
 * List, search, read, create, update and delete for the tables of `homebrew.db`. `source` never
 * arrives as an argument: every write stamps `HOMEBREW_SOURCE` into `json` here, the one
 * place that builds it. The caller chooses `id` once at creation and never reassigns it, so
 * a rename keeps the id a character already references.
 */
import type {
  HomebrewBackgroundInput,
  HomebrewClassFeature,
  HomebrewClassInput,
  HomebrewClassResource,
  HomebrewDeityInput,
  HomebrewFeatInput,
  HomebrewItem,
  HomebrewItemInput,
  HomebrewMonsterInput,
  HomebrewOptionalFeatureInput,
  HomebrewRaceInput,
  HomebrewSkillInput,
  HomebrewSpellInput,
  HomebrewSubclassInput,
  HomebrewSubraceInput,
} from "@dnd/catalog";
import {
  characterOptionEntrySchema,
  HOMEBREW_SOURCE,
  homebrewClassSchema,
  homebrewDeityEntrySchema,
  homebrewItemSchema,
  homebrewMonsterEntrySchema,
  homebrewOptionalFeatureEntrySchema,
  homebrewSkillEntrySchema,
  homebrewSubclassSchema,
  itemKinds,
  ofWantedKind,
  raceEntrySchema,
  spellEntrySchema,
  subraceFullName,
} from "@dnd/catalog";
import type { CharacterDefinition, EntryRef } from "@dnd/character";
import type { Edition } from "@dnd/rules";
import { and, between, eq, inArray, ne, type SQL, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type * as homebrewSchema from "../homebrew.ts";
import {
  homebrewBackgrounds,
  homebrewClasses,
  homebrewClassFeatures,
  homebrewClassResources,
  homebrewDeities,
  homebrewFeats,
  homebrewItems,
  homebrewMonsters,
  homebrewOptionalFeatures,
  homebrewOptionalFeatureTypes,
  homebrewRaces,
  homebrewSkills,
  homebrewSpells,
  homebrewSubclasses,
  homebrewSubclassFeatures,
  homebrewSubraces,
} from "../homebrew.ts";
import type { SearchFilter } from "./catalog-search.ts";
import { escapeLikeTerm } from "./search-terms.ts";

export type HomebrewDb = BetterSQLite3Database<typeof homebrewSchema>;

export function listHomebrewItems(db: HomebrewDb) {
  return db.select().from(homebrewItems).all();
}

const nameHolds = (column: SQLiteColumn, term: string) =>
  sql`${column} LIKE ${`%${escapeLikeTerm(term)}%`} ESCAPE '!'`;

export function searchHomebrewItems(db: HomebrewDb, filter: SearchFilter) {
  return db
    .select()
    .from(homebrewItems)
    .where(
      and(
        filter.edition ? eq(homebrewItems.edition, filter.edition) : undefined,
        filter.term ? nameHolds(homebrewItems.name, filter.term) : undefined,
        filter.rarities?.length ? inArray(homebrewItems.rarity, [...filter.rarities]) : undefined,
      ),
    )
    .all()
    .filter((row) => ofWantedKind(itemKinds(row.json), filter.itemKinds));
}

/** A homebrew table `/search` reads by name and edition alone, with no facet to narrow it. */
export type NamedSearchTable =
  | typeof homebrewRaces
  | typeof homebrewClasses
  | typeof homebrewBackgrounds
  | typeof homebrewFeats
  | typeof homebrewMonsters;

export function searchHomebrewNamed(db: HomebrewDb, table: NamedSearchTable, filter: SearchFilter) {
  return db
    .select({ id: table.id, name: table.name, edition: table.edition })
    .from(table)
    .where(
      and(
        filter.edition ? eq(table.edition, filter.edition) : undefined,
        filter.term ? nameHolds(table.name, filter.term) : undefined,
      ),
    )
    .all();
}

const SEARCHED_TABLES = [
  homebrewItems,
  homebrewSpells,
  homebrewRaces,
  homebrewClasses,
  homebrewBackgrounds,
  homebrewFeats,
  homebrewDeities,
  homebrewOptionalFeatures,
  homebrewMonsters,
];

/** The sources a homebrew row `/search` can return cites: `HOMEBREW_SOURCE` once any searched row exists. */
export function listHomebrewSearchSources(db: HomebrewDb): string[] {
  const held = SEARCHED_TABLES.some(
    (table) => db.select({ id: table.id }).from(table).limit(1).get() !== undefined,
  );
  return held ? [HOMEBREW_SOURCE] : [];
}

/** Every feature type a homebrew optional feature is offered under, once each. */
export function listHomebrewFeatureTypes(db: HomebrewDb): string[] {
  return db
    .selectDistinct({ featureType: homebrewOptionalFeatureTypes.featureType })
    .from(homebrewOptionalFeatureTypes)
    .all()
    .map((row) => row.featureType);
}

/**
 * Every homebrew race, subrace and class name by id, for the summaries a character list
 * computes on read. Ids are random UUIDs in every table, so one map spans the kinds.
 */
export function homebrewNames(db: HomebrewDb): Map<string, string> {
  const rows = [
    ...db.select({ id: homebrewRaces.id, name: homebrewRaces.name }).from(homebrewRaces).all(),
    ...db
      .select({ id: homebrewSubraces.id, name: homebrewSubraces.name })
      .from(homebrewSubraces)
      .all(),
    ...db
      .select({ id: homebrewClasses.id, name: homebrewClasses.name })
      .from(homebrewClasses)
      .all(),
  ];
  return new Map(rows.map(({ id, name }) => [id, name]));
}

/** A homebrew table whose rows a `{@tag}` names, each name unique within its edition. */
export type NamedHomebrewTable =
  | typeof homebrewItems
  | typeof homebrewSpells
  | typeof homebrewBackgrounds
  | typeof homebrewFeats
  | typeof homebrewRaces
  | typeof homebrewClasses
  | typeof homebrewSkills
  | typeof homebrewMonsters;

/** Classic before the 2024 edition, stated rather than left to how the two values sort. */
const classicFirst = (table: NamedHomebrewTable) =>
  sql`CASE ${table.edition} WHEN 'classic' THEN 0 ELSE 1 END`;

/**
 * The row of `table` named `name`, compared as the unique index compares it, ignoring case:
 * in `edition`, or with none the classic row before the 2024 one.
 */
export function homebrewNamed(
  db: HomebrewDb,
  table: NamedHomebrewTable,
  name: string,
  edition?: Edition,
) {
  return db
    .select({ id: table.id, name: table.name, edition: table.edition, json: table.json })
    .from(table)
    .where(
      and(
        sql`${table.name} = ${name} COLLATE NOCASE`,
        edition === undefined ? undefined : eq(table.edition, edition),
      ),
    )
    .orderBy(classicFirst(table))
    .get();
}

/**
 * `ref` as the id of the homebrew class it cites by `(name, "HB")`, the row in `edition`
 * before the other, as the level-up dialog reads it. Any other citation, and a name no
 * homebrew class holds, comes back as it is.
 */
export function asHomebrewIdRef(
  db: HomebrewDb,
  ref: EntryRef,
  edition: CharacterDefinition["edition"],
): EntryRef {
  if ("homebrewId" in ref || ref.source.toUpperCase() !== HOMEBREW_SOURCE) return ref;
  const row =
    homebrewNamed(db, homebrewClasses, ref.name, edition) ??
    homebrewNamed(db, homebrewClasses, ref.name);
  return row ? { homebrewId: row.id } : ref;
}

export function getHomebrewItem(db: HomebrewDb, id: string) {
  return db.select().from(homebrewItems).where(eq(homebrewItems.id, id)).get();
}

function itemJson(input: HomebrewItemInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewItemSchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

/** `"optional"` means attunable, not required — the same reading `packages/content/src/load/items.ts`'s `requiresAttunement` gives it. */
function requiresAttunement(reqAttune: HomebrewItem["reqAttune"]): boolean {
  return reqAttune === true || (typeof reqAttune === "string" && reqAttune !== "optional");
}

function itemColumns(json: ReturnType<typeof itemJson>) {
  return {
    name: json.name,
    type: json.type ?? null,
    rarity: json.rarity ?? null,
    requiresAttunement: requiresAttunement(json.reqAttune),
    json,
  };
}

export function insertHomebrewItem(db: HomebrewDb, id: string, input: HomebrewItemInput) {
  const json = itemJson(input);
  return db
    .insert(homebrewItems)
    .values({ id, edition: input.edition, ...itemColumns(json) })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewItem` reads a miss. */
export function updateHomebrewItem(db: HomebrewDb, id: string, input: HomebrewItemInput) {
  const json = itemJson(input);
  return db
    .update(homebrewItems)
    .set({ edition: input.edition, ...itemColumns(json) })
    .where(eq(homebrewItems.id, id))
    .returning()
    .get();
}

export function deleteHomebrewItem(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewItems).where(eq(homebrewItems.id, id)).run().changes > 0;
}

export function listHomebrewSpells(db: HomebrewDb) {
  return db.select().from(homebrewSpells).all();
}

export function searchHomebrewSpells(db: HomebrewDb, filter: SearchFilter) {
  const { edition, term, spellLevels, schools, concentration } = filter;
  return db
    .select()
    .from(homebrewSpells)
    .where(
      and(
        edition ? eq(homebrewSpells.edition, edition) : undefined,
        term ? nameHolds(homebrewSpells.name, term) : undefined,
        spellLevels ? between(homebrewSpells.level, spellLevels.min, spellLevels.max) : undefined,
        schools?.length ? inArray(homebrewSpells.school, [...schools]) : undefined,
        concentration ? eq(homebrewSpells.concentration, true) : undefined,
      ),
    )
    .all();
}

export function getHomebrewSpell(db: HomebrewDb, id: string) {
  return db.select().from(homebrewSpells).where(eq(homebrewSpells.id, id)).get();
}

function spellJson(input: HomebrewSpellInput) {
  const { edition: _edition, ...entry } = input;
  return spellEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

function spellColumns(json: ReturnType<typeof spellJson>) {
  return {
    name: json.name,
    level: json.level,
    school: json.school,
    concentration: json.duration.some((span) => span.concentration === true),
    ritual: json.meta?.ritual === true,
    json,
  };
}

export function insertHomebrewSpell(db: HomebrewDb, id: string, input: HomebrewSpellInput) {
  const json = spellJson(input);
  return db
    .insert(homebrewSpells)
    .values({ id, edition: input.edition, ...spellColumns(json) })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewSpell` reads a miss. */
export function updateHomebrewSpell(db: HomebrewDb, id: string, input: HomebrewSpellInput) {
  const json = spellJson(input);
  return db
    .update(homebrewSpells)
    .set({ edition: input.edition, ...spellColumns(json) })
    .where(eq(homebrewSpells.id, id))
    .returning()
    .get();
}

export function deleteHomebrewSpell(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewSpells).where(eq(homebrewSpells.id, id)).run().changes > 0;
}

export function listHomebrewBackgrounds(db: HomebrewDb) {
  return db.select().from(homebrewBackgrounds).all();
}

export function getHomebrewBackground(db: HomebrewDb, id: string) {
  return db.select().from(homebrewBackgrounds).where(eq(homebrewBackgrounds.id, id)).get();
}

function backgroundJson(input: HomebrewBackgroundInput) {
  const { edition: _edition, ...entry } = input;
  return characterOptionEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewBackground(
  db: HomebrewDb,
  id: string,
  input: HomebrewBackgroundInput,
) {
  const json = backgroundJson(input);
  return db
    .insert(homebrewBackgrounds)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewBackground` reads a miss. */
export function updateHomebrewBackground(
  db: HomebrewDb,
  id: string,
  input: HomebrewBackgroundInput,
) {
  const json = backgroundJson(input);
  return db
    .update(homebrewBackgrounds)
    .set({ edition: input.edition, name: json.name, json })
    .where(eq(homebrewBackgrounds.id, id))
    .returning()
    .get();
}

export function deleteHomebrewBackground(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewBackgrounds).where(eq(homebrewBackgrounds.id, id)).run().changes > 0;
}

export function listHomebrewFeats(db: HomebrewDb) {
  return db.select().from(homebrewFeats).all();
}

export function getHomebrewFeat(db: HomebrewDb, id: string) {
  return db.select().from(homebrewFeats).where(eq(homebrewFeats.id, id)).get();
}

function featJson(input: HomebrewFeatInput) {
  const { edition: _edition, ...entry } = input;
  return characterOptionEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewFeat(db: HomebrewDb, id: string, input: HomebrewFeatInput) {
  const json = featJson(input);
  return db
    .insert(homebrewFeats)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewFeat` reads a miss. */
export function updateHomebrewFeat(db: HomebrewDb, id: string, input: HomebrewFeatInput) {
  const json = featJson(input);
  return db
    .update(homebrewFeats)
    .set({ edition: input.edition, name: json.name, json })
    .where(eq(homebrewFeats.id, id))
    .returning()
    .get();
}

export function deleteHomebrewFeat(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewFeats).where(eq(homebrewFeats.id, id)).run().changes > 0;
}

export function listHomebrewRaces(db: HomebrewDb) {
  return db.select().from(homebrewRaces).all();
}

export function getHomebrewRace(db: HomebrewDb, id: string) {
  return db.select().from(homebrewRaces).where(eq(homebrewRaces.id, id)).get();
}

function raceJson(input: HomebrewRaceInput) {
  const { edition: _edition, ...entry } = input;
  return raceEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewRace(db: HomebrewDb, id: string, input: HomebrewRaceInput) {
  const json = raceJson(input);
  return db
    .insert(homebrewRaces)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/**
 * `undefined` where `id` names no row, the way `getHomebrewRace` reads a miss. A subrace
 * takes its race's edition, so a changed edition carries to them in the same transaction.
 */
export function updateHomebrewRace(db: HomebrewDb, id: string, input: HomebrewRaceInput) {
  const json = raceJson(input);
  return db.transaction((tx) => {
    const row = tx
      .update(homebrewRaces)
      .set({ edition: input.edition, name: json.name, json })
      .where(eq(homebrewRaces.id, id))
      .returning()
      .get();
    if (row) {
      tx.update(homebrewSubraces)
        .set({ edition: input.edition })
        .where(eq(homebrewSubraces.raceId, id))
        .run();
    }
    return row;
  });
}

export function deleteHomebrewRace(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewRaces).where(eq(homebrewRaces.id, id)).run().changes > 0;
}

export function listHomebrewClasses(db: HomebrewDb) {
  return db.select().from(homebrewClasses).all();
}

export function getHomebrewClass(db: HomebrewDb, id: string) {
  return db.select().from(homebrewClasses).where(eq(homebrewClasses.id, id)).get();
}

function classJson(input: HomebrewClassInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewClassSchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

function classColumns(json: ReturnType<typeof classJson>) {
  return { name: json.name, hitDie: json.hd.faces, json };
}

export function insertHomebrewClass(db: HomebrewDb, id: string, input: HomebrewClassInput) {
  const json = classJson(input);
  return db
    .insert(homebrewClasses)
    .values({ id, edition: input.edition, ...classColumns(json) })
    .returning()
    .get();
}

/**
 * `undefined` where `id` names no row, the way `getHomebrewClass` reads a miss. A subclass
 * takes its class's edition, so a changed edition carries to them in the same transaction.
 */
export function updateHomebrewClass(db: HomebrewDb, id: string, input: HomebrewClassInput) {
  const json = classJson(input);
  return db.transaction((tx) => {
    const row = tx
      .update(homebrewClasses)
      .set({ edition: input.edition, ...classColumns(json) })
      .where(eq(homebrewClasses.id, id))
      .returning()
      .get();
    if (row) {
      tx.update(homebrewSubclasses)
        .set({ edition: input.edition })
        .where(eq(homebrewSubclasses.classId, id))
        .run();
    }
    return row;
  });
}

export function deleteHomebrewClass(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewClasses).where(eq(homebrewClasses.id, id)).run().changes > 0;
}

/** A class's features in the order the level table prints them. */
export function listHomebrewClassFeatures(db: HomebrewDb, classId: string): HomebrewClassFeature[] {
  return db
    .select({
      name: homebrewClassFeatures.name,
      level: homebrewClassFeatures.level,
      entries: homebrewClassFeatures.entries,
    })
    .from(homebrewClassFeatures)
    .where(eq(homebrewClassFeatures.classId, classId))
    .orderBy(homebrewClassFeatures.level, homebrewClassFeatures.name)
    .all();
}

/** Replaces the class's whole feature list in one transaction. */
export function replaceHomebrewClassFeatures(
  db: HomebrewDb,
  classId: string,
  features: HomebrewClassFeature[],
) {
  db.transaction((tx) => {
    tx.delete(homebrewClassFeatures).where(eq(homebrewClassFeatures.classId, classId)).run();
    if (features.length > 0) {
      tx.insert(homebrewClassFeatures)
        .values(features.map((feature) => ({ classId, ...feature })))
        .run();
    }
  });
}

/** A class's resource tables by name; `resets` is absent where the table sets none. */
export function listHomebrewClassResources(
  db: HomebrewDb,
  classId: string,
): HomebrewClassResource[] {
  return db
    .select({
      name: homebrewClassResources.name,
      resets: homebrewClassResources.resets,
      maximums: homebrewClassResources.maximums,
    })
    .from(homebrewClassResources)
    .where(eq(homebrewClassResources.classId, classId))
    .orderBy(sql`${homebrewClassResources.name} COLLATE NOCASE`)
    .all()
    .map(({ resets, ...table }) => (resets ? { ...table, resets } : table));
}

/** Replaces the class's whole set of resource tables in one transaction. */
export function replaceHomebrewClassResources(
  db: HomebrewDb,
  classId: string,
  tables: HomebrewClassResource[],
) {
  db.transaction((tx) => {
    tx.delete(homebrewClassResources).where(eq(homebrewClassResources.classId, classId)).run();
    if (tables.length > 0) {
      tx.insert(homebrewClassResources)
        .values(
          tables.map(({ resets, ...table }) => ({ classId, resets: resets ?? null, ...table })),
        )
        .run();
    }
  });
}

/** A subclass's parent as the routes name it: a catalog class by key, a homebrew class by id. */
type SubclassParent = HomebrewSubclassInput["parent"];

/** A subclass to store: the caller's input and the edition its parent class settled. */
export type HomebrewSubclassWrite = HomebrewSubclassInput & { edition: Edition };

const subclassColumns = {
  id: homebrewSubclasses.id,
  name: homebrewSubclasses.name,
  edition: homebrewSubclasses.edition,
  classId: homebrewSubclasses.classId,
  className: sql<string>`coalesce(${homebrewSubclasses.className}, ${homebrewClasses.name})`,
  classSource: sql<string>`coalesce(${homebrewSubclasses.classSource}, ${HOMEBREW_SOURCE})`,
  json: homebrewSubclasses.json,
  createdAt: homebrewSubclasses.createdAt,
};

/** A subclass row with its class resolved, and `parent` as a write would name it again. */
function readSubclasses(db: HomebrewDb, where?: SQL) {
  return db
    .select(subclassColumns)
    .from(homebrewSubclasses)
    .leftJoin(homebrewClasses, eq(homebrewSubclasses.classId, homebrewClasses.id))
    .where(where)
    .all()
    .map((row) => ({
      ...row,
      parent: (row.classId
        ? { classId: row.classId }
        : { name: row.className, source: row.classSource }) satisfies SubclassParent,
    }));
}

export function listHomebrewSubclasses(db: HomebrewDb) {
  return readSubclasses(db);
}

/** The subclasses of one class in one edition: a catalog class by key, or a homebrew one by name (source `HB`). */
export function listHomebrewSubclassesOf(
  db: HomebrewDb,
  className: string,
  classSource: string,
  edition: Edition,
) {
  return readSubclasses(
    db,
    and(
      sql`${subclassColumns.className} = ${className} COLLATE NOCASE`,
      sql`${subclassColumns.classSource} = ${classSource} COLLATE NOCASE`,
      eq(homebrewSubclasses.edition, edition),
    ),
  );
}

export function getHomebrewSubclass(db: HomebrewDb, id: string) {
  return readSubclasses(db, eq(homebrewSubclasses.id, id))[0];
}

/** The subclass named `name` under a parent, compared as the unique indexes compare it. */
export function findHomebrewSubclass(db: HomebrewDb, parent: SubclassParent, name: string) {
  const row = readSubclasses(
    db,
    and(
      sql`${homebrewSubclasses.name} = ${name} COLLATE NOCASE`,
      "classId" in parent
        ? eq(homebrewSubclasses.classId, parent.classId)
        : and(
            sql`${homebrewSubclasses.className} = ${parent.name}`,
            sql`${homebrewSubclasses.classSource} = ${parent.source}`,
          ),
    ),
  )[0];
  return row && { id: row.id, name: row.name, edition: row.edition };
}

/** The subclass a `{@subclass}` tag names, ignoring case; the classic row before the 2024 one. */
export function homebrewSubclassNamed(db: HomebrewDb, name: string) {
  return readSubclasses(db, sql`${homebrewSubclasses.name} = ${name} COLLATE NOCASE`).sort(
    (a, b) => Number(a.edition === "one") - Number(b.edition === "one"),
  )[0];
}

/** The subclasses a homebrew class still has, which its deletion would orphan. */
export function subclassesOfHomebrewClass(db: HomebrewDb, classId: string) {
  return db
    .select({ id: homebrewSubclasses.id, name: homebrewSubclasses.name })
    .from(homebrewSubclasses)
    .where(eq(homebrewSubclasses.classId, classId))
    .orderBy(homebrewSubclasses.name)
    .all();
}

function subclassColumnsOf({ parent, edition, ...entry }: HomebrewSubclassWrite) {
  const json = homebrewSubclassSchema.parse({ ...entry, source: HOMEBREW_SOURCE });
  return {
    name: json.name,
    edition,
    json,
    ...("classId" in parent
      ? { classId: parent.classId, className: null, classSource: null }
      : { classId: null, className: parent.name, classSource: parent.source }),
  };
}

export function insertHomebrewSubclass(db: HomebrewDb, id: string, input: HomebrewSubclassWrite) {
  db.insert(homebrewSubclasses)
    .values({ id, ...subclassColumnsOf(input) })
    .run();
  const row = getHomebrewSubclass(db, id);
  if (!row) throw new Error(`Subclass ${id} was inserted and did not read back`);
  return row;
}

/** `undefined` where `id` names no row, the way `getHomebrewSubclass` reads a miss. */
export function updateHomebrewSubclass(db: HomebrewDb, id: string, input: HomebrewSubclassWrite) {
  db.update(homebrewSubclasses)
    .set(subclassColumnsOf(input))
    .where(eq(homebrewSubclasses.id, id))
    .run();
  return getHomebrewSubclass(db, id);
}

export function deleteHomebrewSubclass(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewSubclasses).where(eq(homebrewSubclasses.id, id)).run().changes > 0;
}

/** A subclass's features in the order a level table prints them. */
export function listHomebrewSubclassFeatures(
  db: HomebrewDb,
  subclassId: string,
): HomebrewClassFeature[] {
  return db
    .select({
      name: homebrewSubclassFeatures.name,
      level: homebrewSubclassFeatures.level,
      entries: homebrewSubclassFeatures.entries,
    })
    .from(homebrewSubclassFeatures)
    .where(eq(homebrewSubclassFeatures.subclassId, subclassId))
    .orderBy(homebrewSubclassFeatures.level, homebrewSubclassFeatures.name)
    .all();
}

/** Replaces the subclass's whole feature list in one transaction. */
export function replaceHomebrewSubclassFeatures(
  db: HomebrewDb,
  subclassId: string,
  features: HomebrewClassFeature[],
) {
  db.transaction((tx) => {
    tx.delete(homebrewSubclassFeatures)
      .where(eq(homebrewSubclassFeatures.subclassId, subclassId))
      .run();
    if (features.length > 0) {
      tx.insert(homebrewSubclassFeatures)
        .values(features.map((feature) => ({ subclassId, ...feature })))
        .run();
    }
  });
}

/** A subrace's parent as the routes name it: a catalog race by key, a homebrew race by id. */
type SubraceParent = HomebrewSubraceInput["parent"];

/** A subrace to store: the caller's input and the edition its parent race settled. */
export type HomebrewSubraceWrite = HomebrewSubraceInput & { edition: Edition };

const subraceColumns = {
  id: homebrewSubraces.id,
  name: homebrewSubraces.name,
  edition: homebrewSubraces.edition,
  raceId: homebrewSubraces.raceId,
  raceName: sql<string>`coalesce(${homebrewSubraces.raceName}, ${homebrewRaces.name})`,
  raceSource: sql<string>`coalesce(${homebrewSubraces.raceSource}, ${HOMEBREW_SOURCE})`,
  json: homebrewSubraces.json,
  createdAt: homebrewSubraces.createdAt,
};

/** A subrace row with its race resolved, and `parent` as a write would name it again. */
function readSubraces(db: HomebrewDb, where?: SQL) {
  return db
    .select(subraceColumns)
    .from(homebrewSubraces)
    .leftJoin(homebrewRaces, eq(homebrewSubraces.raceId, homebrewRaces.id))
    .where(where)
    .all()
    .map((row) => ({
      ...row,
      parent: (row.raceId
        ? { raceId: row.raceId }
        : { name: row.raceName, source: row.raceSource }) satisfies SubraceParent,
    }));
}

export function listHomebrewSubraces(db: HomebrewDb) {
  return readSubraces(db);
}

/** The subraces of one race in one edition: a catalog race by key, or a homebrew one by name (source `HB`). */
export function listHomebrewSubracesOf(
  db: HomebrewDb,
  raceName: string,
  raceSource: string,
  edition: Edition,
) {
  return readSubraces(
    db,
    and(
      sql`${subraceColumns.raceName} = ${raceName} COLLATE NOCASE`,
      sql`${subraceColumns.raceSource} = ${raceSource} COLLATE NOCASE`,
      eq(homebrewSubraces.edition, edition),
    ),
  );
}

export function getHomebrewSubrace(db: HomebrewDb, id: string) {
  return readSubraces(db, eq(homebrewSubraces.id, id))[0];
}

/** The subrace named `name` under a parent, compared as the unique indexes compare it. */
export function findHomebrewSubrace(db: HomebrewDb, parent: SubraceParent, name: string) {
  const row = readSubraces(
    db,
    and(
      sql`${homebrewSubraces.name} = ${name} COLLATE NOCASE`,
      "raceId" in parent
        ? eq(homebrewSubraces.raceId, parent.raceId)
        : and(
            sql`${homebrewSubraces.raceName} = ${parent.name}`,
            sql`${homebrewSubraces.raceSource} = ${parent.source}`,
          ),
    ),
  )[0];
  return row && { id: row.id, name: row.name, edition: row.edition };
}

/**
 * The subrace a `{@race}` tag names by its full name, ignoring case; the classic row before
 * the 2024 one. Compared in code, since the full name joins the race's name to the subrace's.
 */
export function homebrewSubraceNamed(db: HomebrewDb, fullName: string) {
  const wanted = fullName.toLowerCase();
  return readSubraces(db)
    .filter((row) => subraceFullName(row.raceName, row.name).toLowerCase() === wanted)
    .sort((a, b) => Number(a.edition === "one") - Number(b.edition === "one"))[0];
}

/** The subraces a homebrew race still has, which its deletion would orphan. */
export function subracesOfHomebrewRace(db: HomebrewDb, raceId: string) {
  return db
    .select({ id: homebrewSubraces.id, name: homebrewSubraces.name })
    .from(homebrewSubraces)
    .where(eq(homebrewSubraces.raceId, raceId))
    .orderBy(homebrewSubraces.name)
    .all();
}

function subraceColumnsOf({ parent, edition, ...entry }: HomebrewSubraceWrite) {
  const json = raceEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
  return {
    name: json.name,
    edition,
    json,
    ...("raceId" in parent
      ? { raceId: parent.raceId, raceName: null, raceSource: null }
      : { raceId: null, raceName: parent.name, raceSource: parent.source }),
  };
}

export function insertHomebrewSubrace(db: HomebrewDb, id: string, input: HomebrewSubraceWrite) {
  db.insert(homebrewSubraces)
    .values({ id, ...subraceColumnsOf(input) })
    .run();
  const row = getHomebrewSubrace(db, id);
  if (!row) throw new Error(`Subrace ${id} was inserted and did not read back`);
  return row;
}

/** `undefined` where `id` names no row, the way `getHomebrewSubrace` reads a miss. */
export function updateHomebrewSubrace(db: HomebrewDb, id: string, input: HomebrewSubraceWrite) {
  db.update(homebrewSubraces).set(subraceColumnsOf(input)).where(eq(homebrewSubraces.id, id)).run();
  return getHomebrewSubrace(db, id);
}

export function deleteHomebrewSubrace(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewSubraces).where(eq(homebrewSubraces.id, id)).run().changes > 0;
}

export function listHomebrewSkills(db: HomebrewDb) {
  return db.select().from(homebrewSkills).all();
}

export function getHomebrewSkill(db: HomebrewDb, id: string) {
  return db.select().from(homebrewSkills).where(eq(homebrewSkills.id, id)).get();
}

function skillJson(input: HomebrewSkillInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewSkillEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewSkill(db: HomebrewDb, id: string, input: HomebrewSkillInput) {
  const json = skillJson(input);
  return db
    .insert(homebrewSkills)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewSkill` reads a miss. */
export function updateHomebrewSkill(db: HomebrewDb, id: string, input: HomebrewSkillInput) {
  const json = skillJson(input);
  return db
    .update(homebrewSkills)
    .set({ edition: input.edition, name: json.name, json })
    .where(eq(homebrewSkills.id, id))
    .returning()
    .get();
}

export function deleteHomebrewSkill(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewSkills).where(eq(homebrewSkills.id, id)).run().changes > 0;
}

/** The homebrew items of the skill's edition whose advantage effects name it, ignoring case. */
export function itemsAdvantagedOnSkill(
  db: HomebrewDb,
  skill: { name: string; edition: Edition },
): { id: string; name: string }[] {
  const wanted = skill.name.toLowerCase();
  return listHomebrewItems(db)
    .filter(
      ({ edition, json }) =>
        edition === skill.edition &&
        json.advantage?.some(
          ({ roll, target }) => roll === "skill" && target?.toLowerCase() === wanted,
        ),
    )
    .map(({ id, name }) => ({ id, name }));
}

export function listHomebrewDeities(db: HomebrewDb) {
  return db.select().from(homebrewDeities).all();
}

export function getHomebrewDeity(db: HomebrewDb, id: string) {
  return db.select().from(homebrewDeities).where(eq(homebrewDeities.id, id)).get();
}

/** A deity is keyed by its name and pantheon together, compared as the unique index does. */
export function findHomebrewDeity(db: HomebrewDb, { name, pantheon }: HomebrewDeityInput) {
  return db
    .select()
    .from(homebrewDeities)
    .where(
      and(
        sql`${homebrewDeities.name} = ${name} COLLATE NOCASE`,
        sql`${homebrewDeities.pantheon} = ${pantheon} COLLATE NOCASE`,
      ),
    )
    .get();
}

/**
 * The deity a `{@deity}` tag names: in `pantheon` where the tag names one, or the first by
 * pantheon where it does not.
 */
export function homebrewDeityNamed(db: HomebrewDb, name: string, pantheon?: string) {
  return db
    .select()
    .from(homebrewDeities)
    .where(
      and(
        sql`${homebrewDeities.name} = ${name} COLLATE NOCASE`,
        pantheon === undefined
          ? undefined
          : sql`${homebrewDeities.pantheon} = ${pantheon} COLLATE NOCASE`,
      ),
    )
    .orderBy(sql`${homebrewDeities.pantheon} COLLATE NOCASE`)
    .get();
}

export function searchHomebrewDeities(db: HomebrewDb, filter: SearchFilter) {
  return db
    .select({
      id: homebrewDeities.id,
      name: homebrewDeities.name,
      pantheon: homebrewDeities.pantheon,
    })
    .from(homebrewDeities)
    .where(filter.term ? nameHolds(homebrewDeities.name, filter.term) : undefined)
    .all();
}

function deityJson(input: HomebrewDeityInput) {
  return homebrewDeityEntrySchema.parse({ ...input, source: HOMEBREW_SOURCE });
}

export function insertHomebrewDeity(db: HomebrewDb, id: string, input: HomebrewDeityInput) {
  const json = deityJson(input);
  return db
    .insert(homebrewDeities)
    .values({ id, name: json.name, pantheon: json.pantheon, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewDeity` reads a miss. */
export function updateHomebrewDeity(db: HomebrewDb, id: string, input: HomebrewDeityInput) {
  const json = deityJson(input);
  return db
    .update(homebrewDeities)
    .set({ name: json.name, pantheon: json.pantheon, json })
    .where(eq(homebrewDeities.id, id))
    .returning()
    .get();
}

export function deleteHomebrewDeity(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewDeities).where(eq(homebrewDeities.id, id)).run().changes > 0;
}

export function listHomebrewOptionalFeatures(db: HomebrewDb) {
  return db.select().from(homebrewOptionalFeatures).all();
}

export function getHomebrewOptionalFeature(db: HomebrewDb, id: string) {
  return db
    .select()
    .from(homebrewOptionalFeatures)
    .where(eq(homebrewOptionalFeatures.id, id))
    .get();
}

function optionalFeatureJson(input: HomebrewOptionalFeatureInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewOptionalFeatureEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

function writeTypes(
  tx: Pick<HomebrewDb, "insert" | "delete">,
  id: string,
  edition: Edition,
  json: ReturnType<typeof optionalFeatureJson>,
) {
  tx.delete(homebrewOptionalFeatureTypes)
    .where(eq(homebrewOptionalFeatureTypes.featureId, id))
    .run();
  tx.insert(homebrewOptionalFeatureTypes)
    .values(
      json.featureType.map((featureType) => ({
        featureId: id,
        featureType,
        name: json.name,
        edition,
      })),
    )
    .run();
}

export function insertHomebrewOptionalFeature(
  db: HomebrewDb,
  id: string,
  input: HomebrewOptionalFeatureInput,
) {
  const json = optionalFeatureJson(input);
  return db.transaction((tx) => {
    const row = tx
      .insert(homebrewOptionalFeatures)
      .values({ id, edition: input.edition, name: json.name, json })
      .returning()
      .get();
    writeTypes(tx, id, input.edition, json);
    return row;
  });
}

/** `undefined` where `id` names no row, the way `getHomebrewOptionalFeature` reads a miss. */
export function updateHomebrewOptionalFeature(
  db: HomebrewDb,
  id: string,
  input: HomebrewOptionalFeatureInput,
) {
  const json = optionalFeatureJson(input);
  return db.transaction((tx) => {
    const row = tx
      .update(homebrewOptionalFeatures)
      .set({ edition: input.edition, name: json.name, json })
      .where(eq(homebrewOptionalFeatures.id, id))
      .returning()
      .get();
    if (row) writeTypes(tx, id, input.edition, json);
    return row;
  });
}

export function deleteHomebrewOptionalFeature(db: HomebrewDb, id: string): boolean {
  return (
    db.delete(homebrewOptionalFeatures).where(eq(homebrewOptionalFeatures.id, id)).run().changes > 0
  );
}

/**
 * Another feature already holding one of `input`'s types under its name and edition, compared
 * as the unique index does; read only once a write collides. `exceptId` is the feature being
 * replaced, which never collides with itself.
 */
export function findHomebrewOptionalFeature(
  db: HomebrewDb,
  { name, edition, featureType }: HomebrewOptionalFeatureInput,
  exceptId?: string,
) {
  return db
    .select({
      id: homebrewOptionalFeatures.id,
      name: homebrewOptionalFeatures.name,
      edition: homebrewOptionalFeatures.edition,
    })
    .from(homebrewOptionalFeatureTypes)
    .innerJoin(
      homebrewOptionalFeatures,
      eq(homebrewOptionalFeatures.id, homebrewOptionalFeatureTypes.featureId),
    )
    .where(
      and(
        sql`${homebrewOptionalFeatureTypes.name} = ${name} COLLATE NOCASE`,
        eq(homebrewOptionalFeatureTypes.edition, edition),
        inArray(homebrewOptionalFeatureTypes.featureType, featureType),
        exceptId === undefined ? undefined : ne(homebrewOptionalFeatures.id, exceptId),
      ),
    )
    .get();
}

/** Homebrew optional features for `/search`, narrowed to those carrying any one of `featureTypes`. */
export function searchHomebrewOptionalFeatures(db: HomebrewDb, filter: SearchFilter) {
  const { edition, term, featureTypes } = filter;
  return db
    .select({
      id: homebrewOptionalFeatures.id,
      name: homebrewOptionalFeatures.name,
      edition: homebrewOptionalFeatures.edition,
      json: homebrewOptionalFeatures.json,
    })
    .from(homebrewOptionalFeatures)
    .where(
      and(
        edition ? eq(homebrewOptionalFeatures.edition, edition) : undefined,
        term ? nameHolds(homebrewOptionalFeatures.name, term) : undefined,
        featureTypes?.length
          ? inArray(
              homebrewOptionalFeatures.id,
              db
                .select({ id: homebrewOptionalFeatureTypes.featureId })
                .from(homebrewOptionalFeatureTypes)
                .where(inArray(homebrewOptionalFeatureTypes.featureType, [...featureTypes])),
            )
          : undefined,
      ),
    )
    .all();
}

export function listHomebrewMonsters(db: HomebrewDb) {
  return db.select().from(homebrewMonsters).all();
}

export function getHomebrewMonster(db: HomebrewDb, id: string) {
  return db.select().from(homebrewMonsters).where(eq(homebrewMonsters.id, id)).get();
}

function monsterJson(input: HomebrewMonsterInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewMonsterEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewMonster(db: HomebrewDb, id: string, input: HomebrewMonsterInput) {
  const json = monsterJson(input);
  return db
    .insert(homebrewMonsters)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewMonster` reads a miss. */
export function updateHomebrewMonster(db: HomebrewDb, id: string, input: HomebrewMonsterInput) {
  const json = monsterJson(input);
  return db
    .update(homebrewMonsters)
    .set({ edition: input.edition, name: json.name, json })
    .where(eq(homebrewMonsters.id, id))
    .returning()
    .get();
}

export function deleteHomebrewMonster(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewMonsters).where(eq(homebrewMonsters.id, id)).run().changes > 0;
}
