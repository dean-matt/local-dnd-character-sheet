/**
 * Reads `content.db`'s Tier A tables — spells, races, backgrounds, feats, optional
 * features, items, classes and subclasses. Every query opens and closes its own
 * connection through `openContentDb` instead of holding one — the staleness that module
 * exists to avoid.
 */
import type { CatalogSearchType, PreparedSpellCount } from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import type Database from "better-sqlite3";
import { openContentDb } from "../content.ts";

const LIKE_ESCAPE = "!";

/** Escapes a term for a `LIKE ... ESCAPE '!'` pattern, so a literal `%` or `_` cannot turn part of a search term into a wildcard. */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[!%_]/g, (char) => `${LIKE_ESCAPE}${char}`);
}

/** Quotes a term as an FTS5 phrase-prefix query, so punctuation in it cannot break the query's own syntax. */
function ftsPrefixQuery(term: string): string {
  return `"${term.replace(/"/g, '""')}"*`;
}

export type SpellRow = {
  name: string;
  source: string;
  edition: Edition;
  level: number;
  school: string;
  concentration: 0 | 1;
  ritual: 0 | 1;
  json: string;
};

const SPELL_COLUMNS = "name, source, edition, level, school, concentration, ritual, json";

export function listSpells(dataDir: string, edition: Edition): SpellRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${SPELL_COLUMNS} FROM spells WHERE edition = ? ORDER BY name, source`)
      .all(edition) as SpellRow[];
  } finally {
    db.close();
  }
}

export function getSpell(dataDir: string, name: string, source: string): SpellRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${SPELL_COLUMNS} FROM spells WHERE name = ? AND source = ?`)
      .get(name, source) as SpellRow | undefined;
  } finally {
    db.close();
  }
}

/** Several spells by `(name, source)` over one connection, each `undefined` where no row answers. */
export function getSpells(
  dataDir: string,
  refs: readonly { name: string; source: string }[],
): (SpellRow | undefined)[] {
  if (refs.length === 0) return [];
  const db = openContentDb(dataDir);
  try {
    const select = db.prepare(`SELECT ${SPELL_COLUMNS} FROM spells WHERE name = ? AND source = ?`);
    return refs.map((ref) => select.get(ref.name, ref.source) as SpellRow | undefined);
  } finally {
    db.close();
  }
}

export type RaceRow = {
  name: string;
  source: string;
  edition: Edition;
  json: string;
};

const RACE_COLUMNS = "name, source, edition, json";

export function listRaces(dataDir: string, edition: Edition): RaceRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${RACE_COLUMNS} FROM races WHERE edition = ? ORDER BY name, source`)
      .all(edition) as RaceRow[];
  } finally {
    db.close();
  }
}

export function getRace(dataDir: string, name: string, source: string): RaceRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${RACE_COLUMNS} FROM races WHERE name = ? AND source = ?`)
      .get(name, source) as RaceRow | undefined;
  } finally {
    db.close();
  }
}

/** A subrace row is the race and the subrace already merged by the ETL — see docs/data-model.md. */
export type SubraceRow = {
  name: string;
  source: string;
  race_name: string;
  race_source: string;
  edition: Edition;
  json: string;
};

const SUBRACE_COLUMNS = "name, source, race_name, race_source, edition, json";

export function listSubraces(
  dataDir: string,
  raceName: string,
  raceSource: string,
  edition: Edition,
): SubraceRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT ${SUBRACE_COLUMNS} FROM subraces
         WHERE race_name = ? AND race_source = ? AND edition = ?
         ORDER BY name, source`,
      )
      .all(raceName, raceSource, edition) as SubraceRow[];
  } finally {
    db.close();
  }
}

export function getSubrace(
  dataDir: string,
  name: string,
  source: string,
  raceName: string,
  raceSource: string,
): SubraceRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT ${SUBRACE_COLUMNS} FROM subraces
         WHERE name = ? AND source = ? AND race_name = ? AND race_source = ?`,
      )
      .get(name, source, raceName, raceSource) as SubraceRow | undefined;
  } finally {
    db.close();
  }
}

export type BackgroundRow = {
  name: string;
  source: string;
  edition: Edition;
  json: string;
};

const BACKGROUND_COLUMNS = "name, source, edition, json";

export function listBackgrounds(dataDir: string, edition: Edition): BackgroundRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT ${BACKGROUND_COLUMNS} FROM backgrounds WHERE edition = ? ORDER BY name, source`,
      )
      .all(edition) as BackgroundRow[];
  } finally {
    db.close();
  }
}

export function getBackground(
  dataDir: string,
  name: string,
  source: string,
): BackgroundRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${BACKGROUND_COLUMNS} FROM backgrounds WHERE name = ? AND source = ?`)
      .get(name, source) as BackgroundRow | undefined;
  } finally {
    db.close();
  }
}

export type FeatRow = {
  name: string;
  source: string;
  edition: Edition;
  json: string;
};

const FEAT_COLUMNS = "name, source, edition, json";

export function listFeats(dataDir: string, edition: Edition): FeatRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${FEAT_COLUMNS} FROM feats WHERE edition = ? ORDER BY name, source`)
      .all(edition) as FeatRow[];
  } finally {
    db.close();
  }
}

export function getFeat(dataDir: string, name: string, source: string): FeatRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${FEAT_COLUMNS} FROM feats WHERE name = ? AND source = ?`)
      .get(name, source) as FeatRow | undefined;
  } finally {
    db.close();
  }
}

type OptionalFeatureRow = FeatRow;

export function getOptionalFeature(
  dataDir: string,
  name: string,
  source: string,
): OptionalFeatureRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${FEAT_COLUMNS} FROM optional_features WHERE name = ? AND source = ?`)
      .get(name, source) as OptionalFeatureRow | undefined;
  } finally {
    db.close();
  }
}

export type ItemRow = {
  name: string;
  source: string;
  edition: Edition;
  kind: "item" | "itemGroup" | "baseitem" | "magicvariant";
  type: string | null;
  rarity: string | null;
  requires_attunement: 0 | 1;
  json: string;
};

const ITEM_COLUMNS = "name, source, edition, kind, type, rarity, requires_attunement, json";

/**
 * `item` and `baseitem` only — the two kinds a character can own. An `itemGroup` is the
 * entry a family of items is written under and a `magicvariant` is a template upstream
 * expands against a base item; see docs/items.md.
 */
export function listItems(dataDir: string, edition: Edition): ItemRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT ${ITEM_COLUMNS} FROM items
         WHERE edition = ? AND kind IN ('item', 'baseitem')
         ORDER BY name, source`,
      )
      .all(edition) as ItemRow[];
  } finally {
    db.close();
  }
}

export function getItem(dataDir: string, name: string, source: string): ItemRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE name = ? AND source = ?`)
      .get(name, source) as ItemRow | undefined;
  } finally {
    db.close();
  }
}

export type ClassRow = {
  name: string;
  source: string;
  edition: Edition;
  hit_die: number;
  json: string;
};

const CLASS_COLUMNS = "name, source, edition, hit_die, json";

export function listClasses(dataDir: string, edition: Edition): ClassRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${CLASS_COLUMNS} FROM classes WHERE edition = ? ORDER BY name, source`)
      .all(edition) as ClassRow[];
  } finally {
    db.close();
  }
}

export function getClass(dataDir: string, name: string, source: string): ClassRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${CLASS_COLUMNS} FROM classes WHERE name = ? AND source = ?`)
      .get(name, source) as ClassRow | undefined;
  } finally {
    db.close();
  }
}

export type SubclassRow = {
  name: string;
  source: string;
  short_name: string;
  class_name: string;
  class_source: string;
  edition: Edition;
  json: string;
};

const SUBCLASS_COLUMNS = "name, source, short_name, class_name, class_source, edition, json";

export function listSubclasses(
  dataDir: string,
  className: string,
  classSource: string,
  edition: Edition,
): SubclassRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT ${SUBCLASS_COLUMNS} FROM subclasses
         WHERE class_name = ? AND class_source = ? AND edition = ?
         ORDER BY name, source`,
      )
      .all(className, classSource, edition) as SubclassRow[];
  } finally {
    db.close();
  }
}

export function getSubclass(
  dataDir: string,
  name: string,
  source: string,
  className: string,
  classSource: string,
): SubclassRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT ${SUBCLASS_COLUMNS} FROM subclasses
         WHERE name = ? AND source = ? AND class_name = ? AND class_source = ?`,
      )
      .get(name, source, className, classSource) as SubclassRow | undefined;
  } finally {
    db.close();
  }
}

type ClassResourceRow = { resource_key: string; value: string };
type SpellSlotRow = { slot_level: number; slots: number };
type ClassOptionalFeatureRow = { feature_type: string; known: number };
export type ClassFeatureRow = { name: string; source: string; level: number; json: string };

export type ClassGrantsRow = {
  resources: ClassResourceRow[];
  spellSlots: SpellSlotRow[];
  optionalFeatures: ClassOptionalFeatureRow[];
  features: ClassFeatureRow[];
};

function selectClassSpellSlots(
  db: Database.Database,
  className: string,
  classSource: string,
  level: number,
): SpellSlotRow[] {
  return db
    .prepare(
      `SELECT slot_level, slots FROM spell_slots
       WHERE class_name = ? AND class_source = ? AND level = ?
       ORDER BY slot_level`,
    )
    .all(className, classSource, level) as SpellSlotRow[];
}

function selectSubclassSpellSlots(
  db: Database.Database,
  className: string,
  classSource: string,
  subclassName: string,
  subclassSource: string,
  level: number,
): SpellSlotRow[] {
  return db
    .prepare(
      `SELECT slot_level, slots FROM subclass_spell_slots
       WHERE class_name = ? AND class_source = ?
         AND subclass_name = ? AND subclass_source = ? AND level = ?
       ORDER BY slot_level`,
    )
    .all(className, classSource, subclassName, subclassSource, level) as SpellSlotRow[];
}

/** The slots a class's own table prints at one level — pact magic's too, which shares the table. */
export function getClassSpellSlots(
  dataDir: string,
  className: string,
  classSource: string,
  level: number,
): SpellSlotRow[] {
  const db = openContentDb(dataDir);
  try {
    return selectClassSpellSlots(db, className, classSource, level);
  } finally {
    db.close();
  }
}

/** The slots a subclass's own table prints at one class level, keyed by its full name. */
export function getSubclassSpellSlots(
  dataDir: string,
  className: string,
  classSource: string,
  subclassName: string,
  subclassSource: string,
  level: number,
): SpellSlotRow[] {
  const db = openContentDb(dataDir);
  try {
    return selectSubclassSpellSlots(
      db,
      className,
      classSource,
      subclassName,
      subclassSource,
      level,
    );
  } finally {
    db.close();
  }
}

function selectClassFeatures(
  db: Database.Database,
  className: string,
  classSource: string,
  level: number,
): ClassFeatureRow[] {
  return db
    .prepare(
      `SELECT name, source, level, json FROM class_features
       WHERE class_name = ? AND class_source = ? AND level <= ?
       ORDER BY level, name`,
    )
    .all(className, classSource, level) as ClassFeatureRow[];
}

function selectSubclassFeatures(
  db: Database.Database,
  className: string,
  classSource: string,
  subclassShortName: string,
  subclassSource: string,
  level: number,
): ClassFeatureRow[] {
  return db
    .prepare(
      `SELECT name, source, level, json FROM subclass_features
       WHERE class_name = ? AND class_source = ?
         AND subclass_short_name = ? AND subclass_source = ? AND level <= ?
       ORDER BY level, name`,
    )
    .all(className, classSource, subclassShortName, subclassSource, level) as ClassFeatureRow[];
}

/** Every feature a class grants up to and including `level`. */
export function getClassFeatures(
  dataDir: string,
  className: string,
  classSource: string,
  level: number,
): ClassFeatureRow[] {
  const db = openContentDb(dataDir);
  try {
    return selectClassFeatures(db, className, classSource, level);
  } finally {
    db.close();
  }
}

/** Every feature a subclass grants up to and including `level`, keyed by its short name. */
export function getSubclassFeatures(
  dataDir: string,
  className: string,
  classSource: string,
  subclassShortName: string,
  subclassSource: string,
  level: number,
): ClassFeatureRow[] {
  const db = openContentDb(dataDir);
  try {
    return selectSubclassFeatures(
      db,
      className,
      classSource,
      subclassShortName,
      subclassSource,
      level,
    );
  } finally {
    db.close();
  }
}

/**
 * What a class grants by one level, assembled in a single connection: the resources and
 * slots printed at that level (a level with no row grants none, per
 * `packages/content/src/load/classes.ts`), the options known by then, and every feature
 * gained up to and including it.
 */
export function getClassGrants(
  dataDir: string,
  className: string,
  classSource: string,
  level: number,
): ClassGrantsRow {
  const db = openContentDb(dataDir);
  try {
    const resources = db
      .prepare(
        `SELECT resource_key, value FROM class_resources
         WHERE class_name = ? AND class_source = ? AND level = ?
         ORDER BY resource_key`,
      )
      .all(className, classSource, level) as ClassResourceRow[];
    const spellSlots = selectClassSpellSlots(db, className, classSource, level);
    const optionalFeatures = db
      .prepare(
        `SELECT feature_type, known FROM class_optional_features
         WHERE class_name = ? AND class_source = ? AND level = ?
         ORDER BY feature_type`,
      )
      .all(className, classSource, level) as ClassOptionalFeatureRow[];
    const features = selectClassFeatures(db, className, classSource, level);
    return { resources, spellSlots, optionalFeatures, features };
  } finally {
    db.close();
  }
}

/** The first class level with a spell slot, `undefined` for a class whose table has none. */
export function getFirstSpellSlotLevel(
  dataDir: string,
  className: string,
  classSource: string,
): number | undefined {
  const db = openContentDb(dataDir);
  try {
    const row = db
      .prepare(
        "SELECT min(level) AS level FROM spell_slots WHERE class_name = ? AND class_source = ?",
      )
      .get(className, classSource) as { level: number | null };
    return row.level ?? undefined;
  } finally {
    db.close();
  }
}

const PREPARED_SPELLS_KEY = "prepared_spells";

type PreparedRow = { level: number; value: string };

/**
 * `packages/content/src/load/classes.ts` stores no row for a level a resource has not
 * reached, so telling "no such column" from "not reached yet" needs every row for the
 * key, not just the one at this level — at most 20, one query reads them all.
 */
function preparedCount(rows: PreparedRow[], level: number, owner: string): PreparedSpellCount {
  if (rows.length === 0) return { prepares: false };
  const atLevel = rows.find((r) => r.level === level);
  if (!atLevel) return { prepares: true, count: 0 };
  const count = Number(atLevel.value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(
      `${owner} level ${level}: prepared_spells value ${atLevel.value} is not a count`,
    );
  }
  return { prepares: true, count };
}

/**
 * The `one`-edition Prepared Spells column for a class at a level. `prepares: false`
 * where the class carries no such column at any level, distinct from `count: 0` where
 * it carries the column but has not reached it yet.
 */
export function getPreparedSpellCount(
  dataDir: string,
  className: string,
  classSource: string,
  level: number,
): PreparedSpellCount {
  const db = openContentDb(dataDir);
  try {
    const rows = db
      .prepare(
        `SELECT level, value FROM class_resources
         WHERE class_name = ? AND class_source = ? AND resource_key = ?`,
      )
      .all(className, classSource, PREPARED_SPELLS_KEY) as PreparedRow[];
    return preparedCount(rows, level, `${className}|${classSource}`);
  } finally {
    db.close();
  }
}

/**
 * The same column on a subclass's own table, where a `one` third caster prints it:
 * `Eldritch Knight` (XPHB) and `Arcane Trickster` (XPHB), under a class that prints none.
 */
export function getSubclassPreparedSpellCount(
  dataDir: string,
  className: string,
  classSource: string,
  subclassName: string,
  subclassSource: string,
  level: number,
): PreparedSpellCount {
  const db = openContentDb(dataDir);
  try {
    const rows = db
      .prepare(
        `SELECT level, value FROM subclass_resources
         WHERE class_name = ? AND class_source = ?
           AND subclass_name = ? AND subclass_source = ? AND resource_key = ?`,
      )
      .all(
        className,
        classSource,
        subclassName,
        subclassSource,
        PREPARED_SPELLS_KEY,
      ) as PreparedRow[];
    return preparedCount(rows, level, `${subclassName}|${subclassSource}`);
  } finally {
    db.close();
  }
}

/**
 * What a subclass grants by one level. `subclassName` addresses the resource, slot and
 * optional-feature tables and `subclassShortName` addresses the feature table — the two
 * spellings `docs/data-model.md` and `packages/content/src/schema.ts` document.
 */
export function getSubclassGrants(
  dataDir: string,
  className: string,
  classSource: string,
  subclassName: string,
  subclassShortName: string,
  subclassSource: string,
  level: number,
): ClassGrantsRow {
  const db = openContentDb(dataDir);
  try {
    const resources = db
      .prepare(
        `SELECT resource_key, value FROM subclass_resources
         WHERE class_name = ? AND class_source = ?
           AND subclass_name = ? AND subclass_source = ? AND level = ?
         ORDER BY resource_key`,
      )
      .all(className, classSource, subclassName, subclassSource, level) as ClassResourceRow[];
    const spellSlots = selectSubclassSpellSlots(
      db,
      className,
      classSource,
      subclassName,
      subclassSource,
      level,
    );
    const optionalFeatures = db
      .prepare(
        `SELECT feature_type, known FROM subclass_optional_features
         WHERE class_name = ? AND class_source = ?
           AND subclass_name = ? AND subclass_source = ? AND level = ?
         ORDER BY feature_type`,
      )
      .all(
        className,
        classSource,
        subclassName,
        subclassSource,
        level,
      ) as ClassOptionalFeatureRow[];
    const features = selectSubclassFeatures(
      db,
      className,
      classSource,
      subclassShortName,
      subclassSource,
      level,
    );
    return { resources, spellSlots, optionalFeatures, features };
  } finally {
    db.close();
  }
}

export type SkillRow = { name: string; source: string; ability: string | null };

/** One edition's skills from Tier B's `lookups`, where `ability` is the one field a sheet reads. */
export function listSkills(dataDir: string, edition: Edition): SkillRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT name, source, json_extract(json, '$.ability') AS ability FROM lookups
         WHERE kind = 'skill' AND edition = ? ORDER BY name, source`,
      )
      .all(edition) as SkillRow[];
  } finally {
    db.close();
  }
}

export type CatalogMetaRow = { key: string; value: string };

const UPSTREAM_TAG_KEY = "upstream_tag";

/**
 * `content.db`'s `meta` table — what `pnpm content:build` stamped it with — or `undefined`
 * when no build has ever run and `data/content/current` does not exist yet.
 */
export function getCatalogMeta(dataDir: string): CatalogMetaRow[] | undefined {
  let db: Database.Database;
  try {
    db = openContentDb(dataDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return db.prepare("SELECT key, value FROM meta ORDER BY key").all() as CatalogMetaRow[];
  } finally {
    db.close();
  }
}

/** The catalog's upstream 5etools tag, or `undefined` before a catalog has been built. */
export function getCatalogVersion(dataDir: string): string | undefined {
  return getCatalogMeta(dataDir)?.find((row) => row.key === UPSTREAM_TAG_KEY)?.value;
}

export type CatalogSearchRow = {
  type: string;
  name: string;
  source: string;
  edition: Edition | null;
};

/**
 * The Tier A tables a search reads, each keyed by `(name, source)` alone — see
 * `@dnd/catalog`'s `CatalogSearchType` for why subclasses and subraces, whose key reaches
 * into a parent, are not among them. `items` narrows to the two kinds a character can
 * own, matching `listItems`.
 */
const CATALOG_SEARCH_TABLES: { type: CatalogSearchType; table: string; where?: string }[] = [
  { type: "spell", table: "spells" },
  { type: "item", table: "items", where: "kind IN ('item', 'baseitem')" },
  { type: "race", table: "races" },
  { type: "background", table: "backgrounds" },
  { type: "feat", table: "feats" },
  { type: "class", table: "classes" },
  { type: "optfeature", table: "optional_features" },
];

/**
 * Searches the catalog: every Tier A table `CATALOG_SEARCH_TABLES` names, matched by a
 * substring `LIKE` over `name`, and Tier C's `entities`, matched by `entities_fts` over
 * name and rendered text. content.db carries no index spanning the sixteen Tier A
 * tables, so a search here is O(rows) per table rather than tuned ranking — an index
 * spanning the tiers is a `packages/content` change the day the scan is too slow, not an
 * API one. `type` narrows to one source across both tiers, and a caller reading `null`
 * from an `edition`-less Tier C hit is reading a row that applies to either ruleset, not
 * a hit this search failed to classify.
 */
export function searchCatalog(
  dataDir: string,
  edition: Edition,
  term: string,
  type?: string,
): CatalogSearchRow[] {
  const db = openContentDb(dataDir);
  try {
    const pattern = `%${escapeLikeTerm(term)}%`;
    const rows: CatalogSearchRow[] = [];

    for (const entry of CATALOG_SEARCH_TABLES) {
      if (type !== undefined && type !== entry.type) continue;
      const extra = entry.where ? ` AND ${entry.where}` : "";
      const tableRows = db
        .prepare(
          `SELECT name, source FROM ${entry.table}
           WHERE edition = ? AND name LIKE ? ESCAPE '!'${extra}`,
        )
        .all(edition, pattern) as { name: string; source: string }[];
      for (const row of tableRows) {
        rows.push({ type: entry.type, name: row.name, source: row.source, edition });
      }
    }

    const entityParams: unknown[] = [ftsPrefixQuery(term), edition];
    let entitySql = `
      SELECT e.type, e.name, e.source, e.edition
      FROM entities_fts f
      JOIN entities e ON e.rowid = f.rowid
      WHERE entities_fts MATCH ? AND (e.edition = ? OR e.edition IS NULL)
    `;
    if (type !== undefined) {
      entitySql += " AND e.type = ?";
      entityParams.push(type);
    }
    const entityRows = db.prepare(entitySql).all(...entityParams) as CatalogSearchRow[];
    rows.push(...entityRows);

    return rows;
  } finally {
    db.close();
  }
}
