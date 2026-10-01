import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewSpellsRoutes } from "./homebrew-spells.ts";
import { acidSplash, baseDefinition, json } from "./homebrewFixtures.ts";

describe("homebrewSpellsRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewSpellsRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewSpellsRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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

    it("refuses a create or rename onto a name its edition holds, naming the holder", async () => {
      const held = await (await routes.request("/homebrew/spells", json(acidSplash()))).json();
      const other = await (
        await routes.request("/homebrew/spells", json(acidSplash({ name: "Frost Splash" })))
      ).json();
      const conflict = { id: held.id, name: "Acid Splash", edition: "one" };

      const create = await routes.request(
        "/homebrew/spells",
        json(acidSplash({ name: "acid splash" })),
      );
      expect(create.status).toBe(409);
      expect((await create.json()).conflict).toEqual(conflict);

      const rename = await routes.request(`/homebrew/spells/${other.id}`, {
        ...json(acidSplash()),
        method: "PUT",
      });
      expect(rename.status).toBe(409);
      expect((await rename.json()).conflict).toEqual(conflict);

      const classic = await routes.request(
        "/homebrew/spells",
        json(acidSplash({ edition: "classic" })),
      );
      expect(classic.status).toBe(201);
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
});
