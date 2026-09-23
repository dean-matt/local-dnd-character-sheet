import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { insertCharacter } from "../db/queries/characters.ts";
import { charactersRoutes } from "./characters.ts";
import { homebrewRoutes } from "./homebrew.ts";

const sunblade = (overrides: Record<string, unknown> = {}) => ({
  name: "Sunblade",
  edition: "one",
  type: "M",
  rarity: "rare",
  ...overrides,
});

const acidSplash = (overrides: Record<string, unknown> = {}) => ({
  name: "Acid Splash",
  edition: "one",
  level: 0,
  school: "C",
  duration: [{ type: "instant" }],
  ...overrides,
});

const wanderer = (overrides: Record<string, unknown> = {}) => ({
  name: "Wanderer",
  edition: "one",
  ...overrides,
});

const ironbound = (overrides: Record<string, unknown> = {}) => ({
  name: "Ironbound",
  edition: "one",
  ...overrides,
});

const duskling = (overrides: Record<string, unknown> = {}) => ({
  name: "Duskling",
  edition: "one",
  ...overrides,
});

const warden = (overrides: Record<string, unknown> = {}) => ({
  name: "Warden",
  edition: "one",
  hd: { number: 1, faces: 10 },
  ...overrides,
});

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

describe("homebrewRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof homebrewRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-routes-"));
    opened = openDatabases(dataDir);
    routes = homebrewRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("items", () => {
    it("lists no items before any are created", async () => {
      const res = await routes.request("/homebrew/items");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("creates an item, stamping source and generating an id", async () => {
      const res = await routes.request("/homebrew/items", json({ ...sunblade(), source: "PHB" }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Sunblade", edition: "one", requiresAttunement: false });
    });

    it("rejects an item missing a required field, naming which one failed", async () => {
      const res = await routes.request("/homebrew/items", json({ edition: "one" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      const issues = JSON.parse(body.error.message);
      expect(issues).toContainEqual(expect.objectContaining({ path: ["name"] }));
    });

    it("reads an item it just created", async () => {
      const created = await (await routes.request("/homebrew/items", json(sunblade()))).json();

      const res = await routes.request(`/homebrew/items/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/items/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/items/missing", {
        ...json(sunblade()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/items/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("renames an item, keeping its id", async () => {
      const created = await (await routes.request("/homebrew/items", json(sunblade()))).json();

      const res = await routes.request(`/homebrew/items/${created.id}`, {
        ...json(sunblade({ name: "Sunblade+1" })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: created.id, name: "Sunblade+1" });
    });

    it("deletes an item, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/items", json(sunblade()))).json();

      expect(
        (await routes.request(`/homebrew/items/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/items/${created.id}`)).status).toBe(404);
    });

    it("refuses to delete an item a character references, naming the character", async () => {
      const created = await (await routes.request("/homebrew/items", json(sunblade()))).json();
      const character = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({
          inventory: [
            {
              ref: { homebrewId: created.id },
              quantity: 1,
              carried: true,
              equipped: false,
              attuned: false,
            },
          ],
        }),
      });

      const res = await routes.request(`/homebrew/items/${created.id}`, { method: "DELETE" });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.characters).toEqual([{ id: character.id, name: character.name }]);

      expect((await routes.request(`/homebrew/items/${created.id}`)).status).toBe(200);

      const sheet = charactersRoutes(opened.charactersDb);
      expect((await sheet.request(`/characters/${character.id}`)).status).toBe(200);
    });
  });

  describe("spells", () => {
    it("creates a spell, stamping source and generating an id", async () => {
      const res = await routes.request(
        "/homebrew/spells",
        json({ ...acidSplash(), source: "PHB" }),
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Acid Splash", level: 0, school: "C" });
    });

    it("reads a spell it just created", async () => {
      const created = await (await routes.request("/homebrew/spells", json(acidSplash()))).json();

      const res = await routes.request(`/homebrew/spells/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/spells/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/spells/missing", {
        ...json(acidSplash()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/spells/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("deletes a spell, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/spells", json(acidSplash()))).json();

      expect(
        (await routes.request(`/homebrew/spells/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/spells/${created.id}`)).status).toBe(404);
    });

    it("refuses to delete a spell a character references, naming the character", async () => {
      const created = await (await routes.request("/homebrew/spells", json(acidSplash()))).json();
      const character = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({
          spells: [{ ref: { homebrewId: created.id }, prepared: false }],
        }),
      });

      const res = await routes.request(`/homebrew/spells/${created.id}`, { method: "DELETE" });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.characters).toEqual([{ id: character.id, name: character.name }]);

      expect((await routes.request(`/homebrew/spells/${created.id}`)).status).toBe(200);
    });
  });

  describe("backgrounds", () => {
    it("lists no backgrounds before any are created", async () => {
      const res = await routes.request("/homebrew/backgrounds");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("creates a background, stamping source and generating an id", async () => {
      const res = await routes.request(
        "/homebrew/backgrounds",
        json({ ...wanderer(), source: "PHB" }),
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Wanderer", edition: "one" });
    });

    it("rejects a background missing a required field, naming which one failed", async () => {
      const res = await routes.request("/homebrew/backgrounds", json({ edition: "one" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      const issues = JSON.parse(body.error.message);
      expect(issues).toContainEqual(expect.objectContaining({ path: ["name"] }));
    });

    it("reads a background it just created", async () => {
      const created = await (
        await routes.request("/homebrew/backgrounds", json(wanderer()))
      ).json();

      const res = await routes.request(`/homebrew/backgrounds/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/backgrounds/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/backgrounds/missing", {
        ...json(wanderer()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect(
        (await routes.request("/homebrew/backgrounds/missing", { method: "DELETE" })).status,
      ).toBe(404);
    });

    it("renames a background, keeping its id", async () => {
      const created = await (
        await routes.request("/homebrew/backgrounds", json(wanderer()))
      ).json();

      const res = await routes.request(`/homebrew/backgrounds/${created.id}`, {
        ...json(wanderer({ name: "Wanderer II" })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: created.id, name: "Wanderer II" });
    });

    it("deletes a background, after which it 404s", async () => {
      const created = await (
        await routes.request("/homebrew/backgrounds", json(wanderer()))
      ).json();

      expect(
        (await routes.request(`/homebrew/backgrounds/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/backgrounds/${created.id}`)).status).toBe(404);
    });

    it("refuses to delete a background a character references, naming the character", async () => {
      const created = await (
        await routes.request("/homebrew/backgrounds", json(wanderer()))
      ).json();
      const character = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({ background: { homebrewId: created.id } }),
      });

      const res = await routes.request(`/homebrew/backgrounds/${created.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.characters).toEqual([{ id: character.id, name: character.name }]);

      expect((await routes.request(`/homebrew/backgrounds/${created.id}`)).status).toBe(200);

      const sheet = charactersRoutes(opened.charactersDb);
      expect((await sheet.request(`/characters/${character.id}`)).status).toBe(200);
    });
  });

  describe("feats", () => {
    it("lists no feats before any are created", async () => {
      const res = await routes.request("/homebrew/feats");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("creates a feat, stamping source and generating an id", async () => {
      const res = await routes.request("/homebrew/feats", json({ ...ironbound(), source: "PHB" }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Ironbound", edition: "one" });
    });

    it("rejects a feat missing a required field, naming which one failed", async () => {
      const res = await routes.request("/homebrew/feats", json({ edition: "one" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      const issues = JSON.parse(body.error.message);
      expect(issues).toContainEqual(expect.objectContaining({ path: ["name"] }));
    });

    it("reads a feat it just created", async () => {
      const created = await (await routes.request("/homebrew/feats", json(ironbound()))).json();

      const res = await routes.request(`/homebrew/feats/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/feats/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/feats/missing", {
        ...json(ironbound()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/feats/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("renames a feat, keeping its id", async () => {
      const created = await (await routes.request("/homebrew/feats", json(ironbound()))).json();

      const res = await routes.request(`/homebrew/feats/${created.id}`, {
        ...json(ironbound({ name: "Ironbound II" })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: created.id, name: "Ironbound II" });
    });

    it("deletes a feat, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/feats", json(ironbound()))).json();

      expect(
        (await routes.request(`/homebrew/feats/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/feats/${created.id}`)).status).toBe(404);
    });

    it("refuses to delete a feat a character references, naming the character", async () => {
      const created = await (await routes.request("/homebrew/feats", json(ironbound()))).json();
      const character = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({ feats: [{ ref: { homebrewId: created.id } }] }),
      });

      const res = await routes.request(`/homebrew/feats/${created.id}`, { method: "DELETE" });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.characters).toEqual([{ id: character.id, name: character.name }]);

      expect((await routes.request(`/homebrew/feats/${created.id}`)).status).toBe(200);

      const sheet = charactersRoutes(opened.charactersDb);
      expect((await sheet.request(`/characters/${character.id}`)).status).toBe(200);
    });
  });

  describe("races", () => {
    it("lists no races before any are created", async () => {
      const res = await routes.request("/homebrew/races");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("creates a race, stamping source and generating an id", async () => {
      const res = await routes.request("/homebrew/races", json({ ...duskling(), source: "PHB" }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Duskling", edition: "one" });
    });

    it("rejects a race missing a required field, naming which one failed", async () => {
      const res = await routes.request("/homebrew/races", json({ edition: "one" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      const issues = JSON.parse(body.error.message);
      expect(issues).toContainEqual(expect.objectContaining({ path: ["name"] }));
    });

    it("reads a race it just created", async () => {
      const created = await (await routes.request("/homebrew/races", json(duskling()))).json();

      const res = await routes.request(`/homebrew/races/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/races/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/races/missing", {
        ...json(duskling()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/races/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("renames a race, keeping its id", async () => {
      const created = await (await routes.request("/homebrew/races", json(duskling()))).json();

      const res = await routes.request(`/homebrew/races/${created.id}`, {
        ...json(duskling({ name: "Duskling II" })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: created.id, name: "Duskling II" });
    });

    it("deletes a race, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/races", json(duskling()))).json();

      expect(
        (await routes.request(`/homebrew/races/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/races/${created.id}`)).status).toBe(404);
    });

    it("refuses to delete a race a character references, naming the character", async () => {
      const created = await (await routes.request("/homebrew/races", json(duskling()))).json();
      const character = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({ race: { homebrewId: created.id } }),
      });

      const res = await routes.request(`/homebrew/races/${created.id}`, { method: "DELETE" });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.characters).toEqual([{ id: character.id, name: character.name }]);

      expect((await routes.request(`/homebrew/races/${created.id}`)).status).toBe(200);

      const sheet = charactersRoutes(opened.charactersDb);
      expect((await sheet.request(`/characters/${character.id}`)).status).toBe(200);
    });
  });

  describe("classes", () => {
    it("lists no classes before any are created", async () => {
      const res = await routes.request("/homebrew/classes");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("creates a class, stamping source, generating an id and deriving hitDie", async () => {
      const res = await routes.request("/homebrew/classes", json({ ...warden(), source: "PHB" }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Warden", edition: "one", hitDie: 10 });
    });

    it("rejects a class missing a required field, naming which one failed", async () => {
      const res = await routes.request(
        "/homebrew/classes",
        json({ name: "Warden", edition: "one" }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      const issues = JSON.parse(body.error.message);
      expect(issues).toContainEqual(expect.objectContaining({ path: ["hd"] }));
    });

    it("reads a class it just created", async () => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();

      const res = await routes.request(`/homebrew/classes/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/classes/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/classes/missing", {
        ...json(warden()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/classes/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("renames a class, keeping its id", async () => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();

      const res = await routes.request(`/homebrew/classes/${created.id}`, {
        ...json(warden({ name: "Warden II" })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: created.id, name: "Warden II" });
    });

    it("deletes a class, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();

      expect(
        (await routes.request(`/homebrew/classes/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/classes/${created.id}`)).status).toBe(404);
    });

    it("refuses to delete a class a character references, naming the character", async () => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();
      const character = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({ levels: [{ class: { homebrewId: created.id } }] }),
      });

      const res = await routes.request(`/homebrew/classes/${created.id}`, { method: "DELETE" });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.characters).toEqual([{ id: character.id, name: character.name }]);

      expect((await routes.request(`/homebrew/classes/${created.id}`)).status).toBe(200);

      const sheet = charactersRoutes(opened.charactersDb);
      expect((await sheet.request(`/characters/${character.id}`)).status).toBe(200);
    });
  });
});
