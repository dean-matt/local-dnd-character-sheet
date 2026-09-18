import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { characters } from "../characters.ts";
import { openDatabases } from "../client.ts";
import {
  deleteCharacter,
  getCharacter,
  insertCharacter,
  listCharacters,
  updateCharacterDefinition,
} from "./characters.ts";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const ROGUE = { name: "Rogue", source: "XPHB" };

const baseDefinition = (overrides: Partial<CharacterDefinition> = {}): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "one",
    levels: [{ class: WARLOCK }],
    race: { name: "Half-Elf", source: "XPHB" },
    background: { name: "Charlatan", source: "XPHB" },
    abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
    proficiencies: {
      savingThrows: [],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory: [],
    spells: [],
    ...overrides,
  });

describe("characters queries", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let db: ReturnType<typeof openDatabases>["charactersDb"];

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "characters-queries-"));
    opened = openDatabases(dataDir);
    db = opened.charactersDb;
  });

  afterEach(() => {
    // Windows keeps the file locked until the handle closes, and rmSync then fails.
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("insertCharacter and updateCharacterDefinition", () => {
    it("derives name, level and edition from the definition on insert", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });

      const [row] = db.select().from(characters).where(eq(characters.id, "1")).all();
      expect(row).toMatchObject({ name: "Vex", level: 1, edition: "one" });
    });

    it("follows a definition whose name and class levels changed on update", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });

      const grown = baseDefinition({
        name: "Vex the Bold",
        edition: "classic",
        levels: [{ class: WARLOCK }, { class: WARLOCK }, { class: ROGUE }],
      });
      updateCharacterDefinition(db, "1", grown);

      const [row] = db.select().from(characters).where(eq(characters.id, "1")).all();
      expect(row).toMatchObject({ name: "Vex the Bold", level: 3, edition: "classic" });
    });
  });

  describe("listCharacters and getCharacter", () => {
    it("lists every character", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });
      insertCharacter(db, { id: "2", definition: baseDefinition({ name: "Rian" }) });

      expect(
        listCharacters(db)
          .map((row) => row.name)
          .sort(),
      ).toEqual(["Rian", "Vex"]);
    });

    it("reads one character by id, or nothing for an id that does not exist", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });

      expect(getCharacter(db, "1")).toMatchObject({ id: "1", name: "Vex" });
      expect(getCharacter(db, "missing")).toBeUndefined();
    });
  });

  describe("deleteCharacter", () => {
    it("removes the row and reports it existed", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });

      expect(deleteCharacter(db, "1")).toBe(true);
      expect(getCharacter(db, "1")).toBeUndefined();
    });

    it("reports false for an id that does not exist", () => {
      expect(deleteCharacter(db, "missing")).toBe(false);
    });
  });
});
