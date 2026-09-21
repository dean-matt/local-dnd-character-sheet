import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { getSpell, listSpells } from "./content.ts";

const FIREBALL = {
  name: "Fireball",
  source: "PHB",
  edition: "classic",
  level: 3,
  school: "V",
  concentration: 0,
  ritual: 0,
  json: JSON.stringify({ name: "Fireball", source: "PHB", level: 3, school: "V" }),
};

const GOODBERRY_ONE = {
  name: "Goodberry",
  source: "XPHB",
  edition: "one",
  level: 1,
  school: "C",
  concentration: 0,
  ritual: 0,
  json: JSON.stringify({ name: "Goodberry", source: "XPHB", level: 1, school: "C" }),
};

/** Mirrors `build-db.ts`'s publish step against a minimal `spells` table. */
function publishSpells(dataDir: string, rows: (typeof FIREBALL)[]): void {
  const contentDir = join(dataDir, "content");
  mkdirSync(contentDir, { recursive: true });
  const target = join(contentDir, "content-test.db");
  const db = new Database(target);
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
  writeFileSync(join(contentDir, "current.tmp"), "content-test.db");
  renameSync(join(contentDir, "current.tmp"), join(contentDir, "current"));
}

describe("content spell queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists spells filtered to one edition, sorted by name then source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-spells-"));
    publishSpells(dataDir, [FIREBALL, GOODBERRY_ONE]);

    expect(listSpells(dataDir, "classic")).toEqual([FIREBALL]);
    expect(listSpells(dataDir, "one")).toEqual([GOODBERRY_ONE]);
  });

  it("reads one spell by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-spells-"));
    publishSpells(dataDir, [FIREBALL]);

    expect(getSpell(dataDir, "Fireball", "PHB")).toEqual(FIREBALL);
    expect(getSpell(dataDir, "Fireball", "XPHB")).toBeUndefined();
    expect(getSpell(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});
