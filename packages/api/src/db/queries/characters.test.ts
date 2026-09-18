import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { characters } from "../characters.ts";
import { openDatabases } from "../client.ts";
import { insertCharacter, updateCharacterDefinition } from "./characters.ts";

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

describe("insertCharacter and updateCharacterDefinition", () => {
  let dataDir: string;
  let db: ReturnType<typeof openDatabases>["charactersDb"];

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "characters-queries-"));
    db = openDatabases(dataDir).charactersDb;
  });

  afterEach(() => {
    db.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("derives level and edition from the definition on insert", () => {
    insertCharacter(db, { id: "1", name: "Vex", definition: baseDefinition() });

    const [row] = db.select().from(characters).where(eq(characters.id, "1")).all();
    expect(row).toMatchObject({ level: 1, edition: "one" });
  });

  it("follows a definition whose class levels changed on update", () => {
    insertCharacter(db, { id: "1", name: "Vex", definition: baseDefinition() });

    const grown = baseDefinition({
      edition: "classic",
      levels: [{ class: WARLOCK }, { class: WARLOCK }, { class: ROGUE }],
    });
    updateCharacterDefinition(db, "1", grown);

    const [row] = db.select().from(characters).where(eq(characters.id, "1")).all();
    expect(row).toMatchObject({ level: 3, edition: "classic" });
  });
});
