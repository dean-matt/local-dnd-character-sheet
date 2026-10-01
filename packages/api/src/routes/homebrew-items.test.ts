import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { charactersRoutes } from "./characters.ts";
import { homebrewItemsRoutes } from "./homebrew-items.ts";
import { baseDefinition, json, sunblade } from "./homebrewFixtures.ts";

describe("homebrewItemsRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewItemsRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewItemsRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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

    it("refuses a create or rename onto a name its edition holds, naming the holder", async () => {
      const held = await (await routes.request("/homebrew/items", json(sunblade()))).json();
      const other = await (
        await routes.request("/homebrew/items", json(sunblade({ name: "Moonblade" })))
      ).json();
      const conflict = { id: held.id, name: "Sunblade", edition: "one" };

      const create = await routes.request("/homebrew/items", json(sunblade({ name: "SUNBLADE" })));
      expect(create.status).toBe(409);
      expect((await create.json()).conflict).toEqual(conflict);

      const rename = await routes.request(`/homebrew/items/${other.id}`, {
        ...json(sunblade()),
        method: "PUT",
      });
      expect(rename.status).toBe(409);
      expect((await rename.json()).conflict).toEqual(conflict);
      expect((await (await routes.request(`/homebrew/items/${other.id}`)).json()).name).toBe(
        "Moonblade",
      );
    });

    it("lets each edition hold a name once, and a row keep its own", async () => {
      const held = await (await routes.request("/homebrew/items", json(sunblade()))).json();

      const classic = await routes.request(
        "/homebrew/items",
        json(sunblade({ edition: "classic" })),
      );
      expect(classic.status).toBe(201);

      const recased = await routes.request(`/homebrew/items/${held.id}`, {
        ...json(sunblade({ name: "SunBlade" })),
        method: "PUT",
      });
      expect(recased.status).toBe(200);
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
});
