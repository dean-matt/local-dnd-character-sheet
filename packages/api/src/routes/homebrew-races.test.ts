import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { charactersRoutes } from "./characters.ts";
import { homebrewRacesRoutes } from "./homebrew-races.ts";
import { baseDefinition, duskling, json } from "./homebrewFixtures.ts";

describe("homebrewRacesRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewRacesRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewRacesRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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
});
