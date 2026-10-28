import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { charactersRoutes } from "./characters.ts";
import { homebrewClassesRoutes } from "./homebrew-classes.ts";
import { baseDefinition, json, warden } from "./homebrewFixtures.ts";

describe("homebrewClassesRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewClassesRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewClassesRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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

    describe("a held class's hit die", () => {
      const hold = (homebrewId: string, id: string, name: string) =>
        insertCharacter(opened.charactersDb, {
          id,
          definition: baseDefinition({ name, levels: [{ class: { homebrewId } }] }),
        });
      const put = (id: string, body: Record<string, unknown>) =>
        routes.request(`/homebrew/classes/${id}`, { ...json(body), method: "PUT" });
      const create = async (body = warden()) =>
        (await routes.request("/homebrew/classes", json(body))).json();

      it("refuses a new die while one character holds the class, naming it", async () => {
        const created = await create();
        const character = hold(created.id, "1", "Vex");

        const res = await put(created.id, warden({ hd: { number: 1, faces: 8 } }));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          error:
            "Warden is held by Vex, so its hit die stays d10. Keep d10, or add a class with another name for the new die.",
          characters: [{ id: character.id, name: "Vex" }],
        });
        const stored = await (await routes.request(`/homebrew/classes/${created.id}`)).json();
        expect(stored.hitDie).toBe(10);
      });

      it("names every holder and no other character", async () => {
        const created = await create();
        const other = await create(warden({ name: "Ranger" }));
        hold(created.id, "a", "A");
        hold(created.id, "b", "B");
        hold(created.id, "c", "C");
        hold(other.id, "d", "D");

        const res = await put(created.id, warden({ hd: { number: 1, faces: 8 } }));
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.characters).toHaveLength(3);
        expect(body.characters).toEqual(
          expect.arrayContaining([
            { id: "a", name: "A" },
            { id: "b", name: "B" },
            { id: "c", name: "C" },
          ]),
        );
        const listed = body.error.match(/held by (.*), so/)[1];
        expect(listed.split(/, and |, /).sort()).toEqual(["A", "B", "C"]);
      });

      it("refuses a rename that also changes the die, keeping both", async () => {
        const created = await create();
        hold(created.id, "1", "Vex");

        const res = await put(created.id, warden({ name: "Keeper", hd: { number: 1, faces: 8 } }));
        expect(res.status).toBe(409);
        const stored = await (await routes.request(`/homebrew/classes/${created.id}`)).json();
        expect(stored).toMatchObject({ name: "Warden", hitDie: 10 });
      });

      it("answers the holders' refusal before a taken name", async () => {
        const created = await create();
        await create(warden({ name: "Ranger" }));
        hold(created.id, "1", "Vex");

        const res = await put(created.id, warden({ name: "Ranger", hd: { number: 1, faces: 8 } }));
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.characters).toEqual([{ id: "1", name: "Vex" }]);
        expect(body).not.toHaveProperty("conflict");
      });

      it("renames a held class that keeps its die", async () => {
        const created = await create();
        hold(created.id, "1", "Vex");

        const res = await put(created.id, warden({ name: "Keeper" }));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ name: "Keeper", hitDie: 10 });
      });

      it("changes the die of a class no character holds", async () => {
        const created = await create();

        const res = await put(created.id, warden({ hd: { number: 1, faces: 8 } }));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ hitDie: 8 });
      });
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

      const sheet = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, tmpdir());
      expect((await sheet.request(`/characters/${character.id}`)).status).toBe(200);
    });
  });
});
