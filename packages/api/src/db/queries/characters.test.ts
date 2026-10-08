import {
  type CharacterDefinition,
  characterDefinitionSchema,
  defaultCharacterState,
} from "@dnd/character";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characterPages, characterState, characters, rollLog, undoLog } from "../characters.ts";
import { openTestDatabases } from "../testDatabases.ts";
import {
  charactersReferencingHomebrew,
  deleteCharacter,
  duplicateCharacter,
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
  let opened: ReturnType<typeof openTestDatabases>;
  let db: ReturnType<typeof openTestDatabases>["charactersDb"];

  beforeEach(() => {
    opened = openTestDatabases();
    db = opened.charactersDb;
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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

    it("takes the character's state, pages, roll log and undo log with it, and no one else's", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });
      insertCharacter(db, { id: "2", definition: baseDefinition({ name: "Rian" }) });
      for (const id of ["1", "2"]) {
        db.insert(rollLog)
          .values({ characterId: id, label: "Stealth", notation: "1d20", result: 12, detail: {} })
          .run();
      }
      updateCharacterDefinition(db, "1", baseDefinition({ name: "Vex the Bold" }));
      updateCharacterDefinition(db, "2", baseDefinition({ name: "Rian the Bold" }));

      deleteCharacter(db, "1");

      for (const table of [characterState, characterPages, rollLog, undoLog]) {
        const owners = db.select({ id: table.characterId }).from(table).all();
        expect(owners.length).toBeGreaterThan(0);
        expect(owners.every((row) => row.id === "2")).toBe(true);
      }
    });
  });

  describe("duplicateCharacter", () => {
    it("copies the definition and pages under the new id, with fresh state and empty logs", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });
      db.update(characterPages)
        .set({ title: "Renamed", hidden: true })
        .where(eq(characterPages.slug, "notes"))
        .run();
      db.insert(characterPages)
        .values({ characterId: "1", slug: "grapple", title: "Grapple", position: 8, blocks: [] })
        .run();
      updateCharacterState(db, "1", {
        ...defaultCharacterState(),
        hitPoints: { current: 3, temporary: 2 },
        spellSlots: [{ level: 1, total: 2, expended: 2 }],
        conditions: [{ name: "Poisoned", source: "XPHB" }],
      });
      db.insert(rollLog)
        .values({ characterId: "1", label: "Stealth", notation: "1d20", result: 12, detail: {} })
        .run();
      updateCharacterDefinition(db, "1", baseDefinition({ name: "Vex the Bold" }));

      const copy = duplicateCharacter(db, "1", "2");

      expect(copy).toMatchObject({ id: "2", name: "Vex the Bold (copy)", level: 1 });
      expect(copy?.definition).toEqual(baseDefinition({ name: "Vex the Bold (copy)" }));
      const pagesOf = (id: string) =>
        db
          .select()
          .from(characterPages)
          .where(eq(characterPages.characterId, id))
          .all()
          .map(({ characterId: _, ...page }) => page);
      expect(pagesOf("2")).toEqual(pagesOf("1"));
      expect(pagesOf("2")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: "notes", title: "Renamed", hidden: true }),
          expect.objectContaining({ slug: "grapple", preset: false }),
        ]),
      );
      expect(getCharacterState(db, "2")?.state).toEqual(defaultCharacterState());
      for (const table of [rollLog, undoLog]) {
        const owners = db.select({ id: table.characterId }).from(table).all();
        expect(owners.map((row) => row.id)).not.toContain("2");
      }
      expect(getCharacter(db, "1")).toMatchObject({ name: "Vex the Bold" });
    });

    it("returns undefined and writes nothing for an id that does not exist", () => {
      expect(duplicateCharacter(db, "missing", "2")).toBeUndefined();
      expect(listCharacters(db)).toEqual([]);
    });
  });

  describe("charactersReferencingHomebrew", () => {
    it("finds a character referencing a homebrew item in its inventory", () => {
      insertCharacter(db, {
        id: "1",
        definition: baseDefinition({
          inventory: [
            {
              ref: { homebrewId: "hb-1" },
              quantity: 1,
              carried: true,
              equipped: false,
              attuned: false,
            },
          ],
        }),
      });
      insertCharacter(db, { id: "2", definition: baseDefinition({ name: "Rian" }) });

      expect(charactersReferencingHomebrew(db, "hb-1")).toEqual([{ id: "1", name: "Vex" }]);
    });

    it("finds a character referencing a homebrew spell", () => {
      insertCharacter(db, {
        id: "1",
        definition: baseDefinition({ spells: [{ ref: { homebrewId: "hb-2" }, prepared: false }] }),
      });

      expect(charactersReferencingHomebrew(db, "hb-2")).toEqual([{ id: "1", name: "Vex" }]);
    });

    it("finds a character referencing a homebrew feat with no grantedBy or level", () => {
      insertCharacter(db, {
        id: "1",
        definition: baseDefinition({ feats: [{ ref: { homebrewId: "hb-3" } }] }),
      });

      expect(charactersReferencingHomebrew(db, "hb-3")).toEqual([{ id: "1", name: "Vex" }]);
    });

    it("finds a character referencing a homebrew optional feature", () => {
      insertCharacter(db, {
        id: "1",
        definition: baseDefinition({
          optionalFeatures: [
            {
              ref: { homebrewId: "hb-4" },
              featureType: "FS",
              grantedBy: { kind: "class", ref: WARLOCK },
            },
          ],
        }),
      });

      expect(charactersReferencingHomebrew(db, "hb-4")).toEqual([{ id: "1", name: "Vex" }]);
    });

    it("finds a character referencing a homebrew grantor of an optional feature", () => {
      insertCharacter(db, {
        id: "1",
        definition: baseDefinition({
          optionalFeatures: [
            {
              ref: ROGUE,
              featureType: "FS",
              grantedBy: { kind: "feat", ref: { homebrewId: "hb-5" } },
            },
          ],
        }),
      });

      expect(charactersReferencingHomebrew(db, "hb-5")).toEqual([{ id: "1", name: "Vex" }]);
    });

    it("finds nothing for a homebrew id no character references", () => {
      insertCharacter(db, { id: "1", definition: baseDefinition() });

      expect(charactersReferencingHomebrew(db, "hb-1")).toEqual([]);
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
