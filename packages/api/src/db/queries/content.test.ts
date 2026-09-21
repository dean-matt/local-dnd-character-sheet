import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getSpell, listSpells } from "./content.ts";
import { publishSpells } from "./contentFixture.ts";

const FIREBALL = {
  name: "Fireball",
  source: "PHB",
  edition: "classic",
  level: 3,
  school: "V",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ name: "Fireball", source: "PHB", level: 3, school: "V" }),
};

const GOODBERRY_ONE = {
  name: "Goodberry",
  source: "XPHB",
  edition: "one",
  level: 1,
  school: "C",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ name: "Goodberry", source: "XPHB", level: 1, school: "C" }),
};

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
