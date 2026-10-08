import {
  type CharacterDefinition,
  characterDefinitionSchema,
  defaultCharacterState,
  PRESET_PAGES,
} from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characters, undoLog } from "../db/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { charactersRoutes } from "./characters.ts";
import { pagesRoutes } from "./pages.ts";

const WARLOCK = { name: "Warlock", source: "XPHB" };

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

const json = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("charactersRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof charactersRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = charactersRoutes(opened.charactersDb, () => {});
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("lists no characters before any are created", async () => {
    const res = await routes.request("/characters");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a character, deriving name, level and edition from the definition", async () => {
    const res = await routes.request("/characters", json(baseDefinition()));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toMatchObject({ name: "Vex", level: 1, edition: "one" });
    expect(typeof body.id).toBe("string");
  });

  it("rejects a definition missing a required field, naming which one failed", async () => {
    const { race: _race, ...withoutRace } = baseDefinition();
    const res = await routes.request("/characters", json(withoutRace));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    const issues = JSON.parse(body.error.message);
    expect(issues).toContainEqual(expect.objectContaining({ path: ["race"] }));
  });

  it("reads a character it just created", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();

    const res = await routes.request(`/characters/${created.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  it("404s reading, updating or deleting an id that does not exist", async () => {
    const getRes = await routes.request("/characters/missing");
    expect(getRes.status).toBe(404);
    expect(await getRes.json()).toEqual({ error: "No character with that id" });

    const putRes = await routes.request("/characters/missing", {
      ...json(baseDefinition()),
      method: "PUT",
    });
    expect(putRes.status).toBe(404);

    const deleteRes = await routes.request("/characters/missing", { method: "DELETE" });
    expect(deleteRes.status).toBe(404);
  });

  it("lists every created character", async () => {
    await routes.request("/characters", json(baseDefinition()));
    await routes.request("/characters", json(baseDefinition({ name: "Rian" })));

    const res = await routes.request("/characters");
    const body = await res.json();
    expect(body.map((row: { name: string }) => row.name).sort()).toEqual(["Rian", "Vex"]);
  });

  it("replaces a character's definition, following its class levels and name", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();

    const grown = baseDefinition({
      name: "Vex the Bold",
      levels: [{ class: WARLOCK }, { class: WARLOCK }],
    });
    const res = await routes.request(`/characters/${created.id}`, {
      ...json(grown),
      method: "PUT",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: created.id, name: "Vex the Bold", level: 2 });
  });

  it("duplicates a character under a new id, and 404s for a miss", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();

    const res = await routes.request(`/characters/${created.id}/duplicate`, { method: "POST" });
    expect(res.status).toBe(201);
    const copy = await res.json();
    expect(copy).toMatchObject({ name: "Vex (copy)", level: 1 });
    expect(copy.id).not.toBe(created.id);
    expect((await routes.request(`/characters/${copy.id}`)).status).toBe(200);

    const miss = await routes.request("/characters/missing/duplicate", { method: "POST" });
    expect(miss.status).toBe(404);
  });

  it("deletes a character, after which it 404s", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();

    const res = await routes.request(`/characters/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    expect((await routes.request(`/characters/${created.id}`)).status).toBe(404);
  });

  it("snapshots the database while the character is still in it, and not for a miss", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();
    const seen: number[] = [];
    const backed = charactersRoutes(opened.charactersDb, () => {
      seen.push(opened.charactersDb.select().from(characters).all().length);
    });

    await backed.request("/characters/missing", { method: "DELETE" });
    expect(seen).toEqual([]);

    expect((await backed.request(`/characters/${created.id}`, { method: "DELETE" })).status).toBe(
      204,
    );
    expect(seen).toEqual([1]);
  });

  it("keeps the character when the snapshot fails", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();
    const failing = charactersRoutes(opened.charactersDb, () => {
      throw new Error("disk full");
    });

    const res = await failing.request(`/characters/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Could not back up characters.db, so nothing was deleted: disk full",
    });
    expect((await routes.request(`/characters/${created.id}`)).status).toBe(200);
  });

  it("reads the default state a character is created with", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();

    const res = await routes.request(`/characters/${created.id}/state`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      characterId: created.id,
      state: defaultCharacterState(),
    });
  });

  it("replaces a character's state without touching its definition", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();

    const hurt = { ...defaultCharacterState(), hitPoints: { current: 4, temporary: 0 } };
    const res = await routes.request(`/characters/${created.id}/state`, {
      ...json(hurt),
      method: "PUT",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ characterId: created.id, state: hurt });

    const definition = await (await routes.request(`/characters/${created.id}`)).json();
    expect(definition).toEqual(created);
  });

  it("404s reading or writing the state of an id that does not exist", async () => {
    const getRes = await routes.request("/characters/missing/state");
    expect(getRes.status).toBe(404);
    expect(await getRes.json()).toEqual({ error: "No character with that id" });

    const putRes = await routes.request("/characters/missing/state", {
      ...json(defaultCharacterState()),
      method: "PUT",
    });
    expect(putRes.status).toBe(404);
  });
});

describe("the character file", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof charactersRoutes>;
  let pages: ReturnType<typeof pagesRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = charactersRoutes(opened.charactersDb, () => {});
    pages = pagesRoutes(opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const create = async (definition = baseDefinition()) =>
    (await routes.request("/characters", json(definition))).json();
  const exportOf = async (id: string) => (await routes.request(`/characters/${id}/export`)).json();
  const importFile = (file: unknown) => routes.request("/characters/import", json(file));

  it("carries definition, state and pages through an export and an import, under a new id", async () => {
    const created = await create();
    const hurt = { ...defaultCharacterState(), hitPoints: { current: 4, temporary: 2 } };
    await routes.request(`/characters/${created.id}/state`, { ...json(hurt), method: "PUT" });
    const grapple = { slug: "grapple", title: "Grapple", hidden: false, blocks: [] };
    const edited = [
      grapple,
      ...PRESET_PAGES.map((page) => ({ ...page, hidden: page.slug === "notes" })),
    ];
    await pages.request(`/characters/${created.id}/pages`, { ...json(edited), method: "PUT" });

    const exported = await exportOf(created.id);
    expect(exported).toMatchObject({ format: "local-dnd-character-sheet/character", version: 1 });
    expect(exported.state).toEqual(hurt);

    const res = await importFile(exported);
    expect(res.status).toBe(201);
    const imported = await res.json();
    expect(imported.id).not.toBe(created.id);
    expect(imported.definition).toEqual(created.definition);
    expect(await exportOf(imported.id)).toEqual(exported);

    const importedPages = await (await pages.request(`/characters/${imported.id}/pages`)).json();
    expect(importedPages.map((page: { preset: boolean }) => page.preset)).toEqual([
      false,
      ...PRESET_PAGES.map(() => true),
    ]);
  });

  it("creates a second character when one file is imported twice, leaving the first", async () => {
    const created = await create();
    const file = await exportOf(created.id);
    const first = await (await importFile(file)).json();
    const second = await (await importFile(file)).json();

    expect(second.id).not.toBe(first.id);
    const ids = (await (await routes.request("/characters")).json()).map(
      (row: { id: string }) => row.id,
    );
    expect(ids.sort()).toEqual([created.id, first.id, second.id].sort());
  });

  it("imports catalog and homebrew references that resolve against nothing as written", async () => {
    const created = await create(
      baseDefinition({
        levels: [{ class: WARLOCK, subclass: { name: "Renamed Patron", source: "XPHB" } }],
        background: { homebrewId: "not-here" },
      }),
    );
    const res = await importFile(await exportOf(created.id));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.definition.levels[0].subclass).toEqual({ name: "Renamed Patron", source: "XPHB" });
    expect(body.definition.background).toEqual({ homebrewId: "not-here" });
  });

  it("refuses a file that fails the schema, naming the field and writing nothing", async () => {
    const file = await exportOf((await create()).id);
    const before = await (await routes.request("/characters")).json();
    file.definition.abilityScores.str = 31;

    const res = await importFile(file);
    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error).toContain(
      "definition.abilityScores.str: A score is a whole number from 1 to 30.",
    );
    expect(await (await routes.request("/characters")).json()).toEqual(before);
  });

  it("404s exporting an id that does not exist", async () => {
    const res = await routes.request("/characters/missing/export");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No character with that id" });
  });
});

describe("the undo log", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof charactersRoutes>;
  let id: string;

  const put = (definition: CharacterDefinition) =>
    routes.request(`/characters/${id}`, { ...json(definition), method: "PUT" });
  const withCha = (cha: number) =>
    baseDefinition({ abilityScores: { ...baseDefinition().abilityScores, cha } });
  const entries = async () =>
    (await (await routes.request(`/characters/${id}/undo`)).json()) as { describedAs: string }[];
  const undo = () => routes.request(`/characters/${id}/undo`, { method: "POST" });

  beforeEach(async () => {
    opened = openTestDatabases();
    routes = charactersRoutes(opened.charactersDb, () => {});
    id = (await (await routes.request("/characters", json(baseDefinition()))).json()).id;
  });

  afterEach(() => {
    vi.useRealTimers();
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("starts empty, and an edit records what it replaced in words", async () => {
    expect(await entries()).toEqual([]);
    await put(withCha(18));
    expect(await entries()).toEqual([
      { id: expect.any(Number), describedAs: "Charisma 17 to 18", changedAt: expect.any(String) },
    ]);
  });

  it("merges a burst on one field into one entry, and splits on another field", async () => {
    for (const cha of [18, 19, 20]) await put(withCha(cha));
    expect((await entries()).map((e) => e.describedAs)).toEqual(["Charisma 17 to 20"]);

    await put(baseDefinition({ name: "Nyx", abilityScores: withCha(20).abilityScores }));
    expect((await entries()).map((e) => e.describedAs)).toEqual([
      "Name Vex to Nyx",
      "Charisma 17 to 20",
    ]);
  });

  it("drops the entry where a burst returns the field to where it started", async () => {
    await put(withCha(18));
    await put(withCha(17));
    expect(await entries()).toEqual([]);
  });

  it("starts a new entry once the burst pauses past the window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await put(withCha(18));
    vi.setSystemTime(new Date("2026-01-01T00:00:31Z"));
    await put(withCha(19));
    expect((await entries()).map((e) => e.describedAs)).toEqual([
      "Charisma 18 to 19",
      "Charisma 17 to 18",
    ]);
  });

  it("restores newest first through the definition write, then has nothing left", async () => {
    await put(withCha(18));
    await put(baseDefinition({ name: "Nyx", abilityScores: withCha(18).abilityScores }));

    const first = await undo();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ name: "Vex", definition: withCha(18) });

    await undo();
    const restored = await (await routes.request(`/characters/${id}`)).json();
    expect(restored.definition).toEqual(baseDefinition());

    const none = await undo();
    expect(none.status).toBe(409);
    expect(await none.json()).toEqual({ error: "Nothing to undo" });
  });

  it("keeps the newest 50 entries", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let at = 1; at <= 55; at++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, at)));
      await put(baseDefinition({ name: `Vex ${at}` }));
    }
    const kept = await entries();
    expect(kept).toHaveLength(50);
    expect(kept[0]?.describedAs).toBe("Name Vex 54 to Vex 55");
    expect(kept.at(-1)?.describedAs).toBe("Name Vex 5 to Vex 6");
    expect(opened.charactersDb.select().from(undoLog).all()).toHaveLength(50);
  });

  it("drops a snapshot its schema rejects, so the next undo reaches the entry behind it", async () => {
    await put(withCha(18));
    opened.charactersDb
      .insert(undoLog)
      .values({ characterId: id, previousState: { name: "" }, describedAs: "Broken" })
      .run();

    const res = await undo();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/^Cannot restore "Broken", so it was dropped/);
    const current = await (await routes.request(`/characters/${id}`)).json();
    expect(current.definition).toEqual(withCha(18));
    expect((await entries()).map((e) => e.describedAs)).toEqual(["Charisma 17 to 18"]);
    expect((await undo()).status).toBe(200);
  });

  it("restores a merged burst to where it started", async () => {
    for (const cha of [18, 19, 20]) await put(withCha(cha));
    await undo();
    const restored = await (await routes.request(`/characters/${id}`)).json();
    expect(restored.definition).toEqual(baseDefinition());
  });

  it("records nothing over a stored definition its schema now refuses", async () => {
    opened.charactersDb
      .update(characters)
      .set({ definition: { name: "" } })
      .run();
    expect((await put(withCha(18))).status).toBe(200);
    expect(await entries()).toEqual([]);
  });

  it("404s listing or undoing for an id that does not exist", async () => {
    expect((await routes.request("/characters/missing/undo")).status).toBe(404);
    expect((await routes.request("/characters/missing/undo", { method: "POST" })).status).toBe(404);
  });
});
