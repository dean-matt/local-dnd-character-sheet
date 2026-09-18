import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { characterState, characters } from "./characters.ts";
import { openDatabases } from "./client.ts";

describe("openDatabases", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "db-client-"));
    opened = openDatabases(dataDir);
  });

  afterEach(() => {
    // Windows keeps the file locked until the handle closes, and rmSync then fails.
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("opens both databases at the given directory, migrated and ready to query", () => {
    const { charactersDb, homebrewDb } = opened;

    expect(charactersDb.select().from(characters).all()).toEqual([]);
    expect(homebrewDb.$client.name).toContain(dataDir);
  });

  it("enforces the cascade from character to character_state, which foreign_keys off would leave orphaned", () => {
    const { charactersDb } = opened;

    charactersDb
      .insert(characters)
      .values({
        id: "1",
        name: "Rian",
        edition: "classic",
        level: 1,
        definition: {},
      })
      .run();
    charactersDb.insert(characterState).values({ characterId: "1", state: {} }).run();

    charactersDb.delete(characters).where(eq(characters.id, "1")).run();

    expect(charactersDb.select().from(characterState).all()).toEqual([]);
  });
});
