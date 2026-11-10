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

/** The limited uses the content build read from a feature's text, both null where it read none. */
export type UsesColumns = { uses: number | null; uses_reset: "short" | "long" | null };

/** A feat's or optional feature's limited uses, or undefined where no row answers. */
export function getUses(
  dataDir: string,
  table: "feats" | "optional_features",
  name: string,
  source: string,
): UsesColumns | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT uses, uses_reset FROM ${table} WHERE name = ? AND source = ?`)
      .get(name, source) as UsesColumns | undefined;
  } finally {
    db.close();
  }
}

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
