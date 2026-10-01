import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { charactersRoutes } from "./characters.ts";
import { homebrewFeatsRoutes } from "./homebrew-feats.ts";
import { baseDefinition, ironbound, json } from "./homebrewFixtures.ts";

describe("homebrewFeatsRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewFeatsRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewFeatsRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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
});
