import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { charactersRoutes } from "./characters.ts";
import { homebrewBackgroundsRoutes } from "./homebrew-backgrounds.ts";
import { baseDefinition, json, wanderer } from "./homebrewFixtures.ts";

describe("homebrewBackgroundsRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewBackgroundsRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewBackgroundsRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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

      const sheet = charactersRoutes(opened.charactersDb, () => {});
      expect((await sheet.request(`/characters/${character.id}`)).status).toBe(200);
    });
  });
});
