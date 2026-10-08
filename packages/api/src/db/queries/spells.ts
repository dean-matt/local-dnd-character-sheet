import type { SpellGrantor } from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";

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

export type ClassList = {
  class: { name: string; source: string };
  subclass?: { name: string; source: string };
};

/**
 * A `WHERE` clause holding a `spells` row on `list`, and the parameters it binds: the
 * class's own list, and the spells its subclass adds to it or offers from another, as the
 * Eldritch Knight offers the wizard's. A class's own picks stay out, since the 2014 bard's
 * Magical Secrets offers every spell there is.
 */
export function classListClause(list: ClassList): { clause: string; params: string[] } {
  const own = `EXISTS (SELECT 1 FROM spell_classes sc
    WHERE sc.spell_name = spells.name AND sc.spell_source = spells.source
    AND sc.class_name = ? AND sc.class_source = ?)`;
  const params = [list.class.name, list.class.source];
  if (!list.subclass) return { clause: own, params };
  const added = `EXISTS (SELECT 1 FROM spell_grants g
    WHERE g.spell_name = spells.name AND g.spell_source = spells.source
    AND g.granted_by = 'subclasses' AND g.chosen = 1 AND g.name = ? AND g.source = ?
    AND g.parent_name = ? AND g.parent_source = ?)`;
  return {
    clause: `(${own} OR ${added})`,
    params: [...params, list.subclass.name, list.subclass.source, ...params],
  };
}

/** The table `spell_grants` names each kind of grantor by. */
const GRANTOR_TABLES: Record<SpellGrantor, string> = {
  class: "classes",
  subclass: "subclasses",
  race: "races",
  subrace: "subraces",
  background: "backgrounds",
  feat: "feats",
  optionalFeature: "optional_features",
};

export type Grantor = {
  kind: SpellGrantor;
  name: string;
  source: string;
  /** A subclass's class or a subrace's race, which the row's key carries. */
  parent?: { name: string; source: string };
};

/** The spells `grantor` gives outright by `level`, by name. */
export function getGrantedSpells(
  dataDir: string,
  grantor: Grantor,
  level: number,
): { name: string; source: string }[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT spell_name AS name, spell_source AS source FROM spell_grants
         WHERE granted_by = ? AND name = ? AND source = ? AND parent_name = ? AND parent_source = ?
         AND chosen = 0 AND level <= ? ORDER BY spell_name, spell_source`,
      )
      .all(
        GRANTOR_TABLES[grantor.kind],
        grantor.name,
        grantor.source,
        grantor.parent?.name ?? "",
        grantor.parent?.source ?? "",
        level,
      ) as { name: string; source: string }[];
  } finally {
    db.close();
  }
}

/** Each catalog spell's level and, where `list` is named, whether it holds the spell. */
export function lookupCatalogSpells(
  dataDir: string,
  refs: readonly { name: string; source: string }[],
  list: ClassList | undefined,
): ({ level: number; listed?: boolean } | undefined)[] {
  if (refs.length === 0) return [];
  const db = openContentDb(dataDir);
  try {
    const held = list && classListClause(list);
    const select = db.prepare(
      `SELECT level${held ? `, ${held.clause} AS listed` : ""} FROM spells WHERE name = ? AND source = ?`,
    );
    return refs.map((ref) => {
      const row = select.get(...(held?.params ?? []), ref.name, ref.source) as
        | { level: number; listed?: 0 | 1 }
        | undefined;
      if (!row) return undefined;
      return row.listed === undefined ? { level: row.level } : { ...row, listed: row.listed === 1 };
    });
  } finally {
    db.close();
  }
}
