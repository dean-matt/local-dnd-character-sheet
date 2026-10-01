import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";

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
