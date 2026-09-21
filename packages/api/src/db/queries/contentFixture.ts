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

export type RaceFixtureRow = {
  name: string;
  source: string;
  edition: string;
  json: string;
};

export type SubraceFixtureRow = {
  name: string;
  source: string;
  race_name: string;
  race_source: string;
  edition: string;
  json: string;
};

export type BackgroundFixtureRow = RaceFixtureRow;
export type FeatFixtureRow = RaceFixtureRow;

export type ItemFixtureRow = {
  name: string;
  source: string;
  edition: string;
  kind: string;
  type: string | null;
  rarity: string | null;
  requires_attunement: 0 | 1;
  json: string;
};

let publishCount = 0;

/**
 * Publishes a fresh `content.db` holding one table, mirroring `build-db.ts`'s publish
 * step: a content-addressed file under `<dataDir>/content/`, made live by rewriting the
 * `current` pointer rather than a rename `openContentDb`'s docs say Windows refuses.
 */
function publishTable(dataDir: string, ddl: string, insert: string, rows: object[]): void {
  const contentDir = join(dataDir, "content");
  mkdirSync(contentDir, { recursive: true });
  const name = `content-test-${publishCount++}.db`;
  const db = new Database(join(contentDir, name));
  db.exec(ddl);
  const stmt = db.prepare(insert);
  for (const row of rows) stmt.run(row);
  db.close();
  writeFileSync(join(contentDir, "current.tmp"), name);
  renameSync(join(contentDir, "current.tmp"), join(contentDir, "current"));
}

/** Mirrors `build-db.ts`'s publish step against a minimal `spells` table. */
export function publishSpells(dataDir: string, rows: SpellFixtureRow[]): void {
  publishTable(
    dataDir,
    `
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
    `,
    "INSERT INTO spells (name, source, edition, level, school, concentration, ritual, json) VALUES (@name, @source, @edition, @level, @school, @concentration, @ritual, @json)",
    rows,
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `races` table. */
export function publishRaces(dataDir: string, rows: RaceFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE races (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    "INSERT INTO races (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
    rows,
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `subraces` table. */
export function publishSubraces(dataDir: string, rows: SubraceFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE subraces (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        race_name TEXT NOT NULL,
        race_source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source, race_name, race_source)
      ) STRICT;
    `,
    "INSERT INTO subraces (name, source, race_name, race_source, edition, json) VALUES (@name, @source, @race_name, @race_source, @edition, @json)",
    rows,
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `backgrounds` table. */
export function publishBackgrounds(dataDir: string, rows: BackgroundFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE backgrounds (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    "INSERT INTO backgrounds (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
    rows,
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `feats` table. */
export function publishFeats(dataDir: string, rows: FeatFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE feats (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    "INSERT INTO feats (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
    rows,
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `items` table. */
export function publishItems(dataDir: string, rows: ItemFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE items (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        kind TEXT NOT NULL,
        type TEXT,
        rarity TEXT,
        requires_attunement INTEGER NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    "INSERT INTO items (name, source, edition, kind, type, rarity, requires_attunement, json) VALUES (@name, @source, @edition, @kind, @type, @rarity, @requires_attunement, @json)",
    rows,
  );
}
