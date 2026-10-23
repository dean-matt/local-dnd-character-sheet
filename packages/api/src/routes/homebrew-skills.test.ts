import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { insertHomebrewItem } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewSkillsRoutes } from "./homebrew-skills.ts";
import { baseDefinition, json, sailing } from "./homebrewFixtures.ts";

describe("homebrewSkillsRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewSkillsRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewSkillsRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  describe("skills", () => {
    it("lists no skills before any are created", async () => {
      const res = await routes.request("/homebrew/skills");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("creates a skill, stamping source and generating an id", async () => {
      const res = await routes.request("/homebrew/skills", json({ ...sailing(), source: "PHB" }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Sailing", edition: "one", json: { ability: "wis" } });
    });

    it("rejects a skill missing a required field, naming which one failed", async () => {
      const res = await routes.request("/homebrew/skills", json({ edition: "one" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      const issues = JSON.parse(body.error.message);
      expect(issues).toContainEqual(expect.objectContaining({ path: ["name"] }));
    });

    it("reads a skill it just created", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();

      const res = await routes.request(`/homebrew/skills/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/skills/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/skills/missing", {
        ...json(sailing()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/skills/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("deletes a skill, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();

      expect(
        (await routes.request(`/homebrew/skills/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/skills/${created.id}`)).status).toBe(404);
    });

    it("refuses to rename or delete a skill a character or an item cites, naming them", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();
      const character = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({
          proficiencies: {
            ...baseDefinition().proficiencies,
            skills: [{ ref: { name: "Sailing", source: "HB" }, level: "none" }],
          },
        }),
      });
      insertHomebrewItem(opened.homebrewDb, "compass", {
        name: "Compass",
        edition: "one",
        advantage: [{ mode: "advantage", roll: "skill", target: "sailing" }],
      });

      const renamed = await routes.request(`/homebrew/skills/${created.id}`, {
        ...json(sailing({ name: "Seafaring" })),
        method: "PUT",
      });
      expect(renamed.status).toBe(409);
      const cited = {
        characters: [{ id: character.id, name: character.name }],
        items: [{ id: "compass", name: "Compass" }],
      };
      expect(await renamed.json()).toMatchObject(cited);

      const res = await routes.request(`/homebrew/skills/${created.id}`, { method: "DELETE" });
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject(cited);
      expect((await routes.request(`/homebrew/skills/${created.id}`)).status).toBe(200);
    });

    it("refuses to move a held skill to another edition, and ignores a holder of the other edition", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();
      insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({
          proficiencies: {
            ...baseDefinition().proficiencies,
            skills: [{ ref: { name: "Sailing", source: "HB" }, level: "none" }],
          },
        }),
      });

      const moved = await routes.request(`/homebrew/skills/${created.id}`, {
        ...json(sailing({ edition: "classic" })),
        method: "PUT",
      });
      expect(moved.status).toBe(409);

      const other = await (
        await routes.request("/homebrew/skills", json(sailing({ edition: "classic" })))
      ).json();
      const res = await routes.request(`/homebrew/skills/${other.id}`, { method: "DELETE" });
      expect(res.status).toBe(204);
    });

    it("renames a skill nothing cites, keeping its id", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();

      const res = await routes.request(`/homebrew/skills/${created.id}`, {
        ...json(sailing({ name: "Seafaring" })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ id: created.id, name: "Seafaring" });
    });
  });
});
