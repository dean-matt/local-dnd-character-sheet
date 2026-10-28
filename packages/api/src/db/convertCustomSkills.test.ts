import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { characterDefinitionSchema } from "@dnd/character";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "./client.ts";
import { publishDerivedFixture } from "./queries/contentFixture.ts";

const skill = (name: string, source: string, edition: string, ability: string) => ({
  kind: "skill",
  name,
  source,
  edition,
  json: JSON.stringify({ name, source, ability }),
});

const definition = characterDefinitionSchema.parse({
  name: "Vex",
  edition: "classic",
  levels: [{ class: { name: "Fighter", source: "PHB" } }],
  race: { name: "Elf", source: "PHB" },
  background: { name: "Soldier", source: "PHB" },
  abilityScores: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
  proficiencies: {
    savingThrows: ["str", "con"],
    skills: [],
    armor: [],
    weapons: [],
    tools: [],
    languages: [],
  },
  inventory: [],
  spells: [],
});

const legacy = (customSkills: unknown[], overrides: Record<string, unknown> = {}) => ({
  ...definition,
  customSkills,
  overrides,
});

describe("convertStoredCustomSkills", () => {
  let dataDir: string;
  const handles: Database.Database[] = [];

  const open = () => {
    const opened = openDatabases(dataDir);
    handles.push(opened.charactersDb.$client, opened.homebrewDb.$client);
    return opened;
  };

  const store = (id: string, stored: unknown, snapshots: unknown[] = [], createdAt = 1) => {
    const opened = open();
    const sqlite = opened.charactersDb.$client;
    sqlite
      .prepare(
        "INSERT INTO characters (id, name, edition, level, definition, created_at) VALUES (?, 'Vex', 'classic', 1, ?, ?)",
      )
      .run(id, JSON.stringify(stored), createdAt);
    sqlite.prepare("INSERT INTO character_state (character_id, state) VALUES (?, '{}')").run(id);
    snapshots.forEach((previous, i) => {
      sqlite
        .prepare(
          "INSERT INTO undo_log (character_id, previous_state, described_as) VALUES (?, ?, ?)",
        )
        .run(id, JSON.stringify(previous), `edit ${i}`);
    });
    sqlite.close();
    opened.homebrewDb.$client.close();
  };

  const snapshot = () => {
    const opened = open();
    const characters = opened.charactersDb.$client;
    const homebrew = opened.homebrewDb.$client;
    return {
      characters: characters.prepare("SELECT id, definition FROM characters ORDER BY id").all(),
      undo: characters.prepare("SELECT id, previous_state FROM undo_log ORDER BY id").all(),
      homebrew: homebrew
        .prepare("SELECT name, edition, json FROM homebrew_skills ORDER BY name")
        .all(),
    };
  };

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "convert-custom-skills-"));
  });

  afterEach(() => {
    for (const sqlite of handles.splice(0)) if (sqlite.open) sqlite.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("holds each custom skill as a homebrew skill, drops the key and changes nothing on a second start", () => {
    publishDerivedFixture(dataDir, { lookups: [skill("Perception", "PHB", "classic", "wis")] });
    store("a", legacy([{ name: "Perception", ability: "str", level: "proficient" }]), [
      legacy([]),
      legacy([{ name: "Perception", ability: "str", level: "proficient" }]),
    ]);

    const first = snapshot();
    const held = JSON.parse((first.characters[0] as { definition: string }).definition);
    expect(held).not.toHaveProperty("customSkills");
    expect(held.proficiencies.skills).toEqual([
      { ref: { name: "Perception (2)", source: "HB" }, level: "proficient" },
    ]);
    expect(first.homebrew).toEqual([
      {
        name: "Perception (2)",
        edition: "classic",
        json: JSON.stringify({ name: "Perception (2)", source: "HB", ability: "str" }),
      },
    ]);
    expect(first.undo).toEqual([]);

    expect(snapshot()).toEqual(first);
  });

  it("leaves both databases in WAL mode after converting", () => {
    publishDerivedFixture(dataDir, { lookups: [] });
    store("a", legacy([{ name: "Juggling", ability: "dex", level: "none" }]));

    const opened = open();

    expect(opened.charactersDb.$client.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(opened.homebrewDb.$client.pragma("journal_mode", { simple: true })).toBe("wal");
  });

  it("strips empty keys without a catalog and keeps the undo history", () => {
    store("a", legacy([]), [legacy([]), { ...definition }]);

    const after = snapshot();
    expect(
      JSON.parse((after.characters[0] as { definition: string }).definition),
    ).not.toHaveProperty("customSkills");
    expect(after.undo).toHaveLength(2);
    expect(snapshot()).toEqual(after);
  });

  it("stops the start naming the rebuild, and changes nothing, when an entry needs a missing catalog", () => {
    store("a", legacy([{ name: "Juggling", ability: "dex", level: "none" }]));
    const sqlite = new Database(join(dataDir, "characters.db"));
    const before = sqlite.prepare("SELECT definition FROM characters").all();
    sqlite.close();

    expect(() => openDatabases(dataDir)).toThrow(/pnpm content:build/);

    const after = new Database(join(dataDir, "characters.db"));
    handles.push(after);
    expect(after.prepare("SELECT definition FROM characters").all()).toEqual(before);
  });

  it("rolls both databases back, releases the attach and names the failure and both copies when a write throws", () => {
    publishDerivedFixture(dataDir, { lookups: [] });
    store("a", legacy([{ name: "Juggling", ability: "dex", level: "none" }]));
    const sqlite = new Database(join(dataDir, "characters.db"));
    sqlite.exec(
      "CREATE TRIGGER refuse BEFORE UPDATE ON characters BEGIN SELECT RAISE(ABORT, 'refused'); END",
    );
    const before = sqlite.prepare("SELECT definition FROM characters").all();
    sqlite.close();

    expect(() => openDatabases(dataDir)).toThrow(
      /refused.*backups[\\/]characters-.*\.db and .*backups[\\/]homebrew-.*\.db/s,
    );

    const check = new Database(join(dataDir, "characters.db"));
    handles.push(check);
    expect(check.prepare("SELECT definition FROM characters").all()).toEqual(before);
    const homebrew = new Database(join(dataDir, "homebrew.db"));
    handles.push(homebrew);
    expect(homebrew.prepare("SELECT * FROM homebrew_skills").all()).toEqual([]);
  });
});
