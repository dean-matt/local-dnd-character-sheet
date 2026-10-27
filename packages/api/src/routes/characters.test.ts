import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CharacterDefinition,
  characterDefinitionSchema,
  defaultCharacterState,
  PRESET_PAGES,
} from "@dnd/character";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { characters, undoLog } from "../db/characters.ts";
import { openDatabases } from "../db/client.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
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
    routes = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, tmpdir());
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

  it("reads a stored total below its level's threshold as the threshold", async () => {
    const levels = Array.from({ length: 5 }, () => ({ class: WARLOCK }));
    const created = await (
      await routes.request("/characters", json(baseDefinition({ levels, experience: 0 })))
    ).json();

    const body = await (await routes.request(`/characters/${created.id}`)).json();
    expect(body.definition.experience).toBe(6500);
  });

  it("refuses a replace with 412 where the character was written after If-Unmodified-Since", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();
    const put = (since: string) =>
      routes.request(`/characters/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Unmodified-Since": since },
        body: JSON.stringify(baseDefinition({ name: "Vex the Bold" })),
      });
    const earlier = new Date(Date.parse(created.updatedAt) - 1000).toUTCString();

    const stale = await put(earlier);
    expect(stale.status).toBe(412);
    expect(await stale.json()).toEqual({
      error: "The character changed since it was read; reload it",
    });
    expect(await (await routes.request(`/characters/${created.id}`)).json()).toEqual(created);

    expect((await put("yesterday")).status).toBe(400);

    const fresh = await put(new Date(created.updatedAt).toUTCString());
    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toMatchObject({ name: "Vex the Bold" });
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
    const backed = charactersRoutes(
      opened.charactersDb,
      () => {
        seen.push(opened.charactersDb.select().from(characters).all().length);
      },
      opened.homebrewDb,
      tmpdir(),
    );

    await backed.request("/characters/missing", { method: "DELETE" });
    expect(seen).toEqual([]);

    expect((await backed.request(`/characters/${created.id}`, { method: "DELETE" })).status).toBe(
      204,
    );
    expect(seen).toEqual([1]);
  });

  it("keeps the character when the snapshot fails", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();
    const failing = charactersRoutes(
      opened.charactersDb,
      () => {
        throw new Error("disk full");
      },
      opened.homebrewDb,
      tmpdir(),
    );

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
    routes = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, tmpdir());
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
    expect(exported).toMatchObject({ format: "local-dnd-character-sheet/character", version: 2 });
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

  it("carries a character whose presets the user deleted, every one, through an import", async () => {
    const created = await create();
    await pages.request(`/characters/${created.id}/pages`, { ...json([]), method: "PUT" });

    const res = await importFile(await exportOf(created.id));
    expect(res.status).toBe(201);
    const imported = await res.json();
    expect(await (await pages.request(`/characters/${imported.id}/pages`)).json()).toEqual([]);
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

  const put = (definition: CharacterDefinition, headers: Record<string, string> = {}) => {
    const body = json(definition);
    return routes.request(`/characters/${id}`, {
      ...body,
      method: "PUT",
      headers: { ...body.headers, ...headers },
    });
  };
  const own = { "Undo-Entry": "own" };
  const withCha = (cha: number) =>
    baseDefinition({ abilityScores: { ...baseDefinition().abilityScores, cha } });
  const entries = async () =>
    (await (await routes.request(`/characters/${id}/undo`)).json()) as {
      id: number;
      describedAs: string;
      changes: string[];
    }[];
  const undo = () => routes.request(`/characters/${id}/undo`, { method: "POST" });

  beforeEach(async () => {
    opened = openTestDatabases();
    routes = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, tmpdir());
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
      {
        id: expect.any(Number),
        describedAs: "Charisma 17 to 18",
        changes: ["Charisma 17 to 18"],
        changedAt: expect.any(String),
      },
    ]);
  });

  it("lists every change an entry holds, measured to the entry after it", async () => {
    const scores = { ...baseDefinition().abilityScores, str: 9, dex: 17, con: 15 };
    await put(baseDefinition({ name: "Nyx", abilityScores: scores }), own);
    await put(withCha(18), own);
    const [newest, older] = await entries();

    expect(older?.describedAs).toBe("Name Vex to Nyx, Strength 8 to 9 and 2 more changes");
    expect(older?.changes).toEqual([
      "Name Vex to Nyx",
      "Strength 8 to 9",
      "Dexterity 16 to 17",
      "Constitution 14 to 15",
    ]);
    expect(newest?.changes).toHaveLength(5);
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

  it("keeps each write sent as its own entry apart inside the window", async () => {
    await put(withCha(18), own);
    await put(withCha(19), own);
    await put(withCha(20));
    expect((await entries()).map((e) => e.describedAs)).toEqual([
      "Charisma 19 to 20",
      "Charisma 18 to 19",
      "Charisma 17 to 18",
    ]);
  });

  it("refuses an Undo-Entry value other than own", async () => {
    expect((await put(withCha(18), { "Undo-Entry": "merge" })).status).toBe(400);
    expect(await entries()).toEqual([]);
  });

  it("undoes each change to a level's hit point gain back to the gain before it", async () => {
    const withGain = (gain: object, departures: { field: string; note: string }[] = []) =>
      baseDefinition({
        levels: [{ class: WARLOCK }, { class: WARLOCK, ...gain }],
        experience: 300,
        departures,
      });
    const second = async () =>
      (await (await routes.request(`/characters/${id}`)).json()).definition;
    await put(withGain({}));
    await put(withGain({ rolled: 8 }), own);
    const noted = [{ field: "levels.1.rolled", note: "Level 2 gains 12 hit points" }];
    await put(withGain({ rolled: 12, typed: true }, noted), own);

    expect((await undo()).status).toBe(200);
    expect(await second()).toEqual(withGain({ rolled: 8 }));
    await undo();
    expect(await second()).toEqual(withGain({}));
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

  describe("back to an earlier entry", () => {
    const undoTo = (body: object, headers: Record<string, string> = {}) => {
      const request = json(body);
      return routes.request(`/characters/${id}/undo`, {
        ...request,
        headers: { ...request.headers, ...headers },
      });
    };
    const read = async () => (await (await routes.request(`/characters/${id}`)).json()).definition;

    beforeEach(async () => {
      for (const cha of [18, 19, 20]) await put(withCha(cha), own);
    });

    it("restores that entry's snapshot in one write and drops it and every newer one", async () => {
      const [newest, middle] = await entries();
      const res = await undoTo({ to: middle?.id, newest: newest?.id });
      expect(res.status).toBe(200);
      expect(await read()).toEqual(withCha(18));
      expect((await entries()).map((e) => e.describedAs)).toEqual(["Charisma 17 to 18"]);
    });

    it("refuses where the log or the character moved on since the client read them", async () => {
      const [newest, , oldest] = await entries();
      await put(withCha(16), own);
      expect((await undoTo({ to: oldest?.id, newest: newest?.id })).status).toBe(412);

      const record = await (await routes.request(`/characters/${id}`)).json();
      const since = new Date(new Date(record.updatedAt).getTime() - 1000).toUTCString();
      const res = await undoTo({ to: oldest?.id }, { "If-Unmodified-Since": since });
      expect(res.status).toBe(412);
      expect(await res.json()).toEqual({
        error: "The character changed since its undo history was read",
      });
      expect(await read()).toEqual(withCha(16));
      expect(await entries()).toHaveLength(4);
    });

    it("409s an entry the log does not hold", async () => {
      const res = await undoTo({ to: 9999 });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "No such undo entry" });
      expect(await entries()).toHaveLength(3);
    });

    it("drops a snapshot its schema rejects alone, keeping the entries after it", async () => {
      const [, middle] = await entries();
      opened.charactersDb
        .update(undoLog)
        .set({ previousState: { name: "" } })
        .where(eq(undoLog.id, middle?.id ?? 0))
        .run();
      expect((await undoTo({ to: middle?.id })).status).toBe(422);
      expect(await read()).toEqual(withCha(20));
      expect((await entries()).map((e) => e.describedAs)).toEqual([
        "Charisma 19 to 20",
        "Charisma 17 to 18",
      ]);
    });
  });

  it("404s listing or undoing for an id that does not exist", async () => {
    expect((await routes.request("/characters/missing/undo")).status).toBe(404);
    expect((await routes.request("/characters/missing/undo", { method: "POST" })).status).toBe(404);
  });
});

describe("importing a file that still carries custom skills", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof charactersRoutes>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "import-custom-skills-"));
    publishDerivedFixture(dataDir, {
      lookups: [
        {
          kind: "skill",
          name: "Perception",
          source: "XPHB",
          edition: "one",
          json: JSON.stringify({ name: "Perception", source: "XPHB", ability: "wis" }),
        },
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  // The import attaches homebrew.db by path, which an in-memory database has none of.
  let databases: string;

  beforeEach(() => {
    databases = mkdtempSync(join(tmpdir(), "import-databases-"));
    opened = openDatabases(databases);
    routes = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, dataDir);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(databases, { recursive: true, force: true });
  });

  const legacyFile = async (customSkills: unknown[], overrides: Record<string, unknown> = {}) => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();
    const file = await (await routes.request(`/characters/${created.id}/export`)).json();
    return { ...file, definition: { ...file.definition, customSkills, overrides } };
  };
  const importFile = (file: unknown) => routes.request("/characters/import", json(file));
  const homebrewRows = () =>
    opened.homebrewDb.$client
      .prepare("SELECT name, edition FROM homebrew_skills ORDER BY name")
      .all();

  it("holds each custom skill as a homebrew skill, with its level, flat number and override", async () => {
    const res = await importFile(
      await legacyFile(
        [
          { name: "Juggling", ability: "dex", level: "expertise" },
          { name: "Perception", flat: 3, level: "proficient" },
        ],
        { "customSkills.Perception.modifier": 9 },
      ),
    );

    expect(res.status).toBe(201);
    const { definition } = await res.json();
    expect(definition).not.toHaveProperty("customSkills");
    expect(definition.proficiencies.skills).toEqual([
      { ref: { name: "Juggling", source: "HB" }, level: "expertise" },
      { ref: { name: "Perception (2)", source: "HB" }, level: "proficient", flat: 3 },
    ]);
    expect(definition.overrides).toEqual({ "skills.Perception (2)|HB.modifier": 9 });
    expect(homebrewRows()).toEqual([
      { name: "Juggling", edition: "one" },
      { name: "Perception (2)", edition: "one" },
    ]);
  });

  it("numbers around a name live homebrew already holds", async () => {
    opened.homebrewDb.$client
      .prepare(
        "INSERT INTO homebrew_skills (id, name, edition, json) VALUES ('x', 'Perception (2)', 'one', ?)",
      )
      .run(JSON.stringify({ name: "Perception (2)", source: "HB", ability: "int" }));

    const res = await importFile(
      await legacyFile([{ name: "Perception", ability: "str", level: "none" }]),
    );

    expect((await res.json()).definition.proficiencies.skills).toEqual([
      { ref: { name: "Perception (3)", source: "HB" }, level: "none" },
    ]);
  });

  it("imports a file carrying only an empty customSkills without reading the catalog", async () => {
    const bare = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, tmpdir());
    const created = await (await bare.request("/characters", json(baseDefinition()))).json();
    const file = await (await bare.request(`/characters/${created.id}/export`)).json();

    const res = await bare.request(
      "/characters/import",
      json({ ...file, definition: { ...file.definition, customSkills: [] } }),
    );

    expect(res.status).toBe(201);
    expect((await res.json()).definition).not.toHaveProperty("customSkills");
  });

  it("writes nothing when entries need a missing catalog, then serves on", async () => {
    const bare = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, tmpdir());
    const file = await legacyFile([{ name: "Juggling", ability: "dex", level: "none" }]);
    const before = await (await routes.request("/characters")).json();

    expect((await bare.request("/characters/import", json(file))).status).toBe(500);

    expect(await (await routes.request("/characters")).json()).toEqual(before);
    expect(homebrewRows()).toEqual([]);
    expect((await importFile(file)).status).toBe(201);
    expect(
      (await importFile(await legacyFile([{ name: "Sailing", ability: "wis", level: "none" }])))
        .status,
    ).toBe(201);
  });

  it("refuses a converted definition that fails the schema, writing nothing", async () => {
    const file = await legacyFile([{ name: "Juggling", ability: "dex", level: "none" }]);
    file.definition.abilityScores.str = 31;

    const res = await importFile(file);

    expect(res.status).toBe(422);
    expect(homebrewRows()).toEqual([]);
  });

  it("refuses a file whose customSkills is not a list, naming the field", async () => {
    const file = await legacyFile([]);
    file.definition.customSkills = "Juggling";

    const res = await importFile(file);

    expect(res.status).toBe(422);
    expect(homebrewRows()).toEqual([]);
  });

  it("exports a file without customSkills, which imports unconverted", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();
    const file = await (await routes.request(`/characters/${created.id}/export`)).json();

    expect(file.definition).not.toHaveProperty("customSkills");
    expect((await importFile(file)).status).toBe(201);
    expect(homebrewRows()).toEqual([]);
  });
});
