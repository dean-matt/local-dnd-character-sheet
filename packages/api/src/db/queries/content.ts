/**
 * Reads `content.db`'s `spells` table. Every query opens and closes its own connection
 * through `openContentDb` instead of holding one — the staleness that module exists to
 * avoid.
 */
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
