import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";

export type SkillRow = { name: string; source: string; ability: string | null };

/** One edition's skills from Tier B's `lookups`, where `ability` is the one field a sheet reads. */
export function listSkills(dataDir: string, edition: Edition): SkillRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT name, source, json_extract(json, '$.ability') AS ability FROM lookups
         WHERE kind = 'skill' AND edition = ? ORDER BY name, source`,
      )
      .all(edition) as SkillRow[];
  } finally {
    db.close();
  }
}
