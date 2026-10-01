import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";

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
