import { type OfferedPicks, offeredPicks, type SpellGrantor } from "@dnd/catalog";
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
  /** The class level the subclass's additions are read at, every level where absent. */
  level?: number;
};

/**
 * A `WHERE` clause holding a `spells` row on `list`, and the parameters it binds: the
 * class's own list, and the spells its subclass adds to it or offers from another, as the
 * Eldritch Knight offers the wizard's, from the levels they arrive at. A class's own picks
 * stay out, since the 2014 bard's Magical Secrets offers every spell there is.
 */
export function classListClause(list: ClassList): {
  clause: string;
  params: (string | number)[];
} {
  const own = `EXISTS (SELECT 1 FROM spell_classes sc
    WHERE sc.spell_name = spells.name AND sc.spell_source = spells.source
    AND sc.class_name = ? AND sc.class_source = ?)`;
  const params = [list.class.name, list.class.source];
  if (!list.subclass) return { clause: own, params };
  const added = `EXISTS (SELECT 1 FROM spell_grants g
    WHERE g.spell_name = spells.name AND g.spell_source = spells.source
    AND g.granted_by = 'subclasses' AND g.chosen = 1 AND g.name = ? AND g.source = ?
    AND g.parent_name = ? AND g.parent_source = ? AND g.level <= ?)`;
  return {
    clause: `(${own} OR ${added})`,
    params: [...params, list.subclass.name, list.subclass.source, ...params, list.level ?? 20],
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

/** The column pair each grantor table keys a parent on, for those that carry one. */
const PARENT_COLUMNS: Partial<Record<SpellGrantor, string>> = {
  subclass: "class_name = ? AND class_source = ?",
  subrace: "race_name = ? AND race_source = ?",
};

/**
 * The spells `grantor` gives outright by `level`, by name, and the picks its row offers by
 * then. A grantor no row answers gives nothing and offers nothing.
 */
export function getGrantedSpells(
  dataDir: string,
  grantor: Grantor,
  level: number,
): { spells: { name: string; source: string }[]; picks: OfferedPicks } {
  const db = openContentDb(dataDir);
  try {
    const parent = [grantor.parent?.name ?? "", grantor.parent?.source ?? ""];
    const spells = db
      .prepare(
        `SELECT spell_name AS name, spell_source AS source FROM spell_grants
         WHERE granted_by = ? AND name = ? AND source = ? AND parent_name = ? AND parent_source = ?
         AND chosen = 0 AND level <= ? ORDER BY spell_name, spell_source`,
      )
      .all(GRANTOR_TABLES[grantor.kind], grantor.name, grantor.source, ...parent, level) as {
      name: string;
      source: string;
    }[];
    const parentColumns = PARENT_COLUMNS[grantor.kind];
    const json = db
      .prepare(
        `SELECT json FROM ${GRANTOR_TABLES[grantor.kind]} WHERE name = ? AND source = ?${parentColumns ? ` AND ${parentColumns}` : ""}`,
      )
      .pluck()
      .get(grantor.name, grantor.source, ...(parentColumns ? parent : [])) as string | undefined;
    return {
      spells,
      picks: offeredPicks(json === undefined ? undefined : JSON.parse(json), level),
    };
  } finally {
    db.close();
  }
}

type Standing = { name: string; level: number; listed?: boolean };

/** Each catalog spell's name and level and, where `list` is named, whether it holds the spell. */
export function lookupCatalogSpells(
  dataDir: string,
  refs: readonly { name: string; source: string }[],
  list: ClassList | undefined,
): (Standing | undefined)[] {
  if (refs.length === 0) return [];
  const db = openContentDb(dataDir);
  try {
    const held = list && classListClause(list);
    const select = db.prepare(
      `SELECT name, level${held ? `, ${held.clause} AS listed` : ""}
       FROM spells WHERE name = ? AND source = ?`,
    );
    return refs.map((ref) => {
      const row = select.get(...(held?.params ?? []), ref.name, ref.source) as
        | { name: string; level: number; listed?: 0 | 1 }
        | undefined;
      if (!row) return undefined;
      const { listed, ...spell } = row;
      return { ...spell, ...(listed !== undefined && { listed: listed === 1 }) };
    });
  } finally {
    db.close();
  }
}
