import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

export type SpellFixtureRow = {
  name: string;
  source: string;
  edition: string;
  level: number;
  school: string;
  concentration: 0 | 1;
  ritual: 0 | 1;
  json: string;
};

let publishCount = 0;

/** Mirrors `build-db.ts`'s publish step against a minimal `spells` table. */
export function publishSpells(dataDir: string, rows: SpellFixtureRow[]): void {
  const contentDir = join(dataDir, "content");
  mkdirSync(contentDir, { recursive: true });
  const name = `content-test-${publishCount++}.db`;
  const db = new Database(join(contentDir, name));
  db.exec(`
    CREATE TABLE spells (
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      edition TEXT NOT NULL,
      level INTEGER NOT NULL,
      school TEXT NOT NULL,
      concentration INTEGER NOT NULL,
      ritual INTEGER NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (name, source)
    ) STRICT;
  `);
  const insert = db.prepare(
    "INSERT INTO spells (name, source, edition, level, school, concentration, ritual, json) VALUES (@name, @source, @edition, @level, @school, @concentration, @ritual, @json)",
  );
  for (const row of rows) insert.run(row);
  db.close();
  writeFileSync(join(contentDir, "current.tmp"), name);
  renameSync(join(contentDir, "current.tmp"), join(contentDir, "current"));
}
