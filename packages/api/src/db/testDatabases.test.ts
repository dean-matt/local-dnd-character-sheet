import { describe, expect, it } from "vitest";
import { characters } from "./characters.ts";
import { openTestDatabases } from "./testDatabases.ts";

describe("openTestDatabases", () => {
  it("hands each call its own migrated copy, so one test's writes never reach the next", () => {
    const first = openTestDatabases();
    first.charactersDb
      .insert(characters)
      .values({
        id: "1",
        name: "Rian",
        edition: "classic",
        level: 1,
        raceSummary: "",
        classSummary: "",
        definition: {},
      })
      .run();
    const second = openTestDatabases();

    expect(first.charactersDb.select().from(characters).all()).toHaveLength(1);
    expect(second.charactersDb.select().from(characters).all()).toEqual([]);
  });

  it("turns foreign keys on in both, as openDatabases does", () => {
    const { charactersDb, homebrewDb } = openTestDatabases();

    expect(charactersDb.$client.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(homebrewDb.$client.pragma("foreign_keys", { simple: true })).toBe(1);
  });
});
