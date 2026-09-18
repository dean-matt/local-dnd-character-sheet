import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CharacterDefinition,
  characterDefinitionSchema,
  defaultCharacterState,
} from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { charactersRoutes } from "./characters.ts";

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
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof charactersRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "characters-routes-"));
    opened = openDatabases(dataDir);
    routes = charactersRoutes(opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
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

  it("creates a second, distinct character when the same definition is imported twice", async () => {
    const definition = baseDefinition();
    const first = await (await routes.request("/characters", json(definition))).json();
    const second = await (await routes.request("/characters", json(definition))).json();

    expect(second.id).not.toBe(first.id);
    const res = await routes.request("/characters");
    expect((await res.json()).map((row: { id: string }) => row.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it("imports a character whose catalog reference resolves against nothing", async () => {
    const renamed = baseDefinition({
      levels: [{ class: WARLOCK, subclass: { name: "Renamed Patron", source: "XPHB" } }],
    });
    const res = await routes.request("/characters", json(renamed));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.definition.levels[0].subclass).toEqual({ name: "Renamed Patron", source: "XPHB" });
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

  it("deletes a character, after which it 404s", async () => {
    const created = await (await routes.request("/characters", json(baseDefinition()))).json();

    const res = await routes.request(`/characters/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    expect((await routes.request(`/characters/${created.id}`)).status).toBe(404);
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
