import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";
import { getOptionalFeature } from "./feats.ts";

export type CatalogRow = {
  type: string;
  name: string;
  source: string;
  qualifier: string;
  edition: Edition | null;
  json: string;
};

/** The search-hit `type` an optional feature carries, the one Tier A type read here. */
const OPTIONAL_FEATURE = "optfeature";

/**
 * One row by the `type` a search hit carries: an optional feature, a `lookups` row by its
 * kind, or an `entities` row by its type. The two tables share no type, so at most one
 * answers. `qualifier` is the empty string on every type but a deity and a card.
 */
export function getCatalogRow(
  dataDir: string,
  type: string,
  name: string,
  source: string,
  qualifier: string,
): CatalogRow | undefined {
  if (type === OPTIONAL_FEATURE) {
    const row = qualifier === "" ? getOptionalFeature(dataDir, name, source) : undefined;
    return row && { type, qualifier, ...row };
  }
  const db = openContentDb(dataDir);
  try {
    const key = "name = ? AND source = ? AND qualifier = ?";
    return db
      .prepare(
        `SELECT kind AS type, name, source, qualifier, edition, json FROM lookups
         WHERE kind = ? AND ${key}
         UNION ALL
         SELECT type, name, source, qualifier, edition, json FROM entities
         WHERE type = ? AND ${key}`,
      )
      .get(type, name, source, qualifier, type, name, source, qualifier) as CatalogRow | undefined;
  } finally {
    db.close();
  }
}
