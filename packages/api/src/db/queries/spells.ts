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
