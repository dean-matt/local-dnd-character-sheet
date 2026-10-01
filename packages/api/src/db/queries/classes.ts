import type { PreparedSpellCount } from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import type Database from "better-sqlite3";
import { openContentDb } from "../content.ts";

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
 * `packages/content/src/load/class-table.ts`), the options known by then, and every feature
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
 * `packages/content/src/load/class-table.ts` stores no row for a level a resource has not
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

function selectClassPrepared(
  db: Database.Database,
  className: string,
  classSource: string,
  level: number,
): PreparedSpellCount {
  const rows = db
    .prepare(
      `SELECT level, value FROM class_resources
       WHERE class_name = ? AND class_source = ? AND resource_key = ?`,
    )
    .all(className, classSource, PREPARED_SPELLS_KEY) as PreparedRow[];
  return preparedCount(rows, level, `${className}|${classSource}`);
}

function selectSubclassPrepared(
  db: Database.Database,
  className: string,
  classSource: string,
  subclassName: string,
  subclassSource: string,
  level: number,
): PreparedSpellCount {
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
    return selectClassPrepared(db, className, classSource, level);
  } finally {
    db.close();
  }
}

/**
 * What a casting class's tables print at the character's level in it, read in one
 * connection: its slots and Prepared Spells column, and its subclass's. A `one` third
 * caster prints both on the subclass — `Eldritch Knight` (XPHB) under a Fighter that
 * prints neither. `subclass` is absent where none was taken or its row is missing.
 */
export type CasterRows = {
  slots: SpellSlotRow[];
  prepared: PreparedSpellCount;
  subclass?: { json: string; slots: SpellSlotRow[]; prepared: PreparedSpellCount };
};

export function getCasterRows(
  dataDir: string,
  classRef: { name: string; source: string },
  subclassRef: { name: string; source: string } | undefined,
  level: number,
): CasterRows {
  const db = openContentDb(dataDir);
  try {
    const { name, source } = classRef;
    const rows: CasterRows = {
      slots: selectClassSpellSlots(db, name, source, level),
      prepared: selectClassPrepared(db, name, source, level),
    };
    if (!subclassRef) return rows;
    const row = db
      .prepare(
        `SELECT json FROM subclasses
         WHERE name = ? AND source = ? AND class_name = ? AND class_source = ?`,
      )
      .get(subclassRef.name, subclassRef.source, name, source) as { json: string } | undefined;
    if (!row) return rows;
    const owner = [name, source, subclassRef.name, subclassRef.source] as const;
    rows.subclass = {
      json: row.json,
      slots: selectSubclassSpellSlots(db, ...owner, level),
      prepared: selectSubclassPrepared(db, ...owner, level),
    };
    return rows;
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
