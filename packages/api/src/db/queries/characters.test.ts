import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CharacterDefinition,
  characterDefinitionSchema,
  defaultCharacterState,
} from "@dnd/character";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characters } from "../characters.ts";
import { openDatabases } from "../client.ts";
import {
  deleteCharacter,
  getCharacter,
  getCharacterState,
  insertCharacter,
  listCharacters,
  updateCharacterDefinition,
  updateCharacterState,
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

  describe("getCharacterState and updateCharacterState", () => {
    it("creates a default state alongside the character", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });

      expect(getCharacterState(db, "1")).toMatchObject({
        characterId: "1",
        state: defaultCharacterState(),
      });
    });

    it("reads nothing for an id that does not exist", () => {
      expect(getCharacterState(db, "missing")).toBeUndefined();
    });

    it("replaces the state without touching the character's definition", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });
      const before = getCharacter(db, "1");

      const hurt = { ...defaultCharacterState(), hitPoints: { current: 4, temporary: 0 } };
      updateCharacterState(db, "1", hurt);

      expect(getCharacterState(db, "1")).toMatchObject({ characterId: "1", state: hurt });
      expect(getCharacter(db, "1")).toEqual(before);
    });

    it("moves updatedAt on every write", () => {
      vi.useFakeTimers();
      try {
        insertCharacter(db, { id: "1", definition: baseDefinition() });
        const before = getCharacterState(db, "1");

        vi.advanceTimersByTime(5_000);
        updateCharacterState(db, "1", defaultCharacterState());

        const after = getCharacterState(db, "1");
        expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("reports nothing for an id that does not exist", () => {
      expect(updateCharacterState(db, "missing", defaultCharacterState())).toBeUndefined();
    });
  });
});
