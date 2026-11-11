import { tmpdir } from "node:os";
import type { HomebrewClassInput } from "@dnd/catalog";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { insertHomebrewClass } from "../db/queries/homebrew.ts";
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
      expect(await res.json()).toEqual({ ...created, resources: [] });
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

    it.each(["|", "}"])("refuses a name containing %s on create and rename", async (bad) => {
      const name = `War${bad}den`;
      const message = `Class "${name}" cannot contain "${bad}"`;
      const posted = await routes.request("/homebrew/classes", json(warden({ name })));
      expect(posted.status).toBe(400);
      expect(JSON.parse((await posted.json()).error.message)[0].message).toBe(message);

      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();
      const put = await routes.request(`/homebrew/classes/${created.id}`, {
        ...json(warden({ name })),
        method: "PUT",
      });
      expect(put.status).toBe(400);
      expect(JSON.parse((await put.json()).error.message)[0].message).toBe(message);
      expect(await (await routes.request("/homebrew/classes")).json()).toEqual([created]);
    });

    it("reads and renames a class stored with a name containing |", async () => {
      insertHomebrewClass(opened.homebrewDb, "legacy", {
        ...warden({ name: "War|den" }),
        edition: "one",
      } as HomebrewClassInput);

      const read = await routes.request("/homebrew/classes/legacy");
      expect(read.status).toBe(200);
      expect(await read.json()).toMatchObject({ name: "War|den" });

      const renamed = await routes.request("/homebrew/classes/legacy", {
        ...json(warden()),
        method: "PUT",
      });
      expect(renamed.status).toBe(200);
      expect(await renamed.json()).toMatchObject({ id: "legacy", name: "Warden" });
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
        hold(other.id, "b", "D");
        hold(created.id, "c", "B");
        hold(created.id, "d", "C");

        const res = await put(created.id, warden({ hd: { number: 1, faces: 8 } }));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          error:
            "Warden is held by A, B, and C, so its hit die stays d10. Keep d10, or add a class with another name for the new die.",
          characters: [
            { id: "a", name: "A" },
            { id: "c", name: "B" },
            { id: "d", name: "C" },
          ],
        });
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

  describe("features", () => {
    const feature = { name: "Second Wind", level: 1, entries: ["Regain hit points."] };

    async function put(id: string, body: unknown) {
      return routes.request(`/homebrew/classes/${id}/features`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("stores a class's features and reads them back by level", async () => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();
      const later = { name: "Action Surge", level: 2, entries: ["Take one extra action."] };

      expect((await put(created.id, [later, feature])).status).toBe(200);

      const res = await routes.request(`/homebrew/classes/${created.id}/features`);
      expect(await res.json()).toEqual([feature, later]);
    });

    it("replaces the list and drops the features with the class", async () => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();
      await put(created.id, [feature]);
      await put(created.id, []);
      const res = await routes.request(`/homebrew/classes/${created.id}/features`);
      expect(await res.json()).toEqual([]);

      await put(created.id, [feature]);
      await routes.request(`/homebrew/classes/${created.id}`, { method: "DELETE" });
      expect(
        opened.homebrewDb.$client
          .prepare("SELECT count(*) AS n FROM homebrew_class_features")
          .get(),
      ).toEqual({ n: 0 });
    });

    it("rejects a level outside 1 to 20 and a repeated name at a level", async () => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();
      expect((await put(created.id, [{ ...feature, level: 21 }])).status).toBe(400);
      expect((await put(created.id, [feature, feature])).status).toBe(400);
    });

    it.each(["|", "}"])("rejects a feature name containing %s and stores nothing", async (bad) => {
      const created = await (await routes.request("/homebrew/classes", json(warden()))).json();
      await put(created.id, [feature]);

      const name = `Fury ${bad} Rage`;
      const res = await put(created.id, [{ ...feature, name }]);

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(JSON.parse(error.message)[0].message).toBe(
        `Feature "${name}" cannot contain "${bad}"`,
      );
      const stored = await routes.request(`/homebrew/classes/${created.id}/features`);
      expect(await stored.json()).toEqual([feature]);
    });

    it("404s for a class that does not exist", async () => {
      expect((await routes.request("/homebrew/classes/missing/features")).status).toBe(404);
      expect((await put("missing", [feature])).status).toBe(404);
    });
  });

  describe("resources", () => {
    const maximums = (from: number) =>
      Array.from({ length: 20 }, (_, i) => (i + 1 >= from ? i + 1 : null));
    const ki = { name: "Ki", resets: "short-rest", maximums: maximums(2) };
    const rage = { name: "Rage", maximums: maximums(1) };

    const put = (id: string, body: unknown) =>
      routes.request(`/homebrew/classes/${id}/resources`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const create = async () =>
      (await (await routes.request("/homebrew/classes", json(warden()))).json()).id as string;

    it("stores the tables and reads them back, a level with no value staying empty", async () => {
      const id = await create();
      expect((await put(id, [rage, ki])).status).toBe(200);

      const tables = await (await routes.request(`/homebrew/classes/${id}/resources`)).json();
      expect(tables).toEqual([ki, rage]);
      const [{ maximums: stored }] = tables;
      expect(stored[0]).toBeNull();
      expect(stored[1]).toBe(2);
    });

    it("reads an absent cadence as unspecified, distinct from none", async () => {
      const id = await create();
      await put(id, [rage, { name: "Luck", resets: "none", maximums: maximums(1) }]);

      const tables = await (await routes.request(`/homebrew/classes/${id}/resources`)).json();
      expect(tables.find((t: { name: string }) => t.name === "Rage")).not.toHaveProperty("resets");
      expect(tables.find((t: { name: string }) => t.name === "Luck").resets).toBe("none");
    });

    it("returns the tables in the class's detail", async () => {
      const id = await create();
      await put(id, [ki, rage]);

      const detail = await (await routes.request(`/homebrew/classes/${id}`)).json();
      expect(detail.resources).toEqual([ki, rage]);
    });

    it("replaces the whole set and drops the tables with the class", async () => {
      const id = await create();
      await put(id, [ki, rage]);
      await put(id, [rage]);
      expect(await (await routes.request(`/homebrew/classes/${id}/resources`)).json()).toEqual([
        rage,
      ]);

      await routes.request(`/homebrew/classes/${id}`, { method: "DELETE" });
      expect(
        opened.homebrewDb.$client
          .prepare("SELECT count(*) AS n FROM homebrew_class_resources")
          .get(),
      ).toEqual({ n: 0 });
    });

    it("rejects a repeated name ignoring case, a short table and an unknown cadence", async () => {
      const id = await create();
      expect((await put(id, [rage, { ...rage, name: "RAGE" }])).status).toBe(400);
      expect((await put(id, [{ ...rage, maximums: [1, 2] }])).status).toBe(400);
      expect((await put(id, [{ ...rage, resets: "dawn" }])).status).toBe(400);
      expect((await put(id, [{ ...rage, maximums: [...maximums(1).slice(1), -1] }])).status).toBe(
        400,
      );
    });

    it("404s for a class that does not exist", async () => {
      expect((await routes.request("/homebrew/classes/missing/resources")).status).toBe(404);
      expect((await put("missing", [rage])).status).toBe(404);
    });
  });
});
