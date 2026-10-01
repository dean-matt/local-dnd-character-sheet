import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";

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
