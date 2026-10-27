import type { Edition } from "@dnd/rules";
import { CatalogOutOfDateError, openContentDb } from "../content.ts";

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

/**
 * The names of one edition's catalog skills, for a check that has no sheet to ask. A missing
 * catalog answers as an out-of-date one, whose message names `pnpm content:build`.
 */
export function catalogSkillNames(dataDir: string, edition: Edition): string[] {
  try {
    return listSkills(dataDir, edition).map(({ name }) => name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new CatalogOutOfDateError();
    throw error;
  }
}
