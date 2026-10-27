import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import { insertHomebrewItem } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { onAppError } from "./errors.ts";
import { homebrewSkillsRoutes } from "./homebrew-skills.ts";
import { baseDefinition, json, sailing } from "./homebrewFixtures.ts";

const catalogSkill = (name: string, source: string, edition: string) => ({
  kind: "skill",
  name,
  source,
  edition,
  json: JSON.stringify({ name, source, ability: "wis" }),
});

const holding = (name: string) =>
  baseDefinition({
    proficiencies: {
      ...baseDefinition().proficiencies,
      skills: [{ ref: { name, source: "HB" }, level: "none" }],
    },
  });

describe("homebrewSkillsRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewSkillsRoutes>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-skills-"));
    publishDerivedFixture(dataDir, {
      lookups: [
        catalogSkill("Perception", "PHB", "classic"),
        catalogSkill("Perception", "XPHB", "one"),
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewSkillsRoutes(opened.homebrewDb, opened.charactersDb, dataDir);
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

    it("creates a flat skill", async () => {
      const res = await routes.request("/homebrew/skills", json(sailing({ ability: "flat" })));
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ json: { ability: "flat" } });
    });

    it("refuses a name a catalog skill of the edition holds, in any case, naming its spelling", async () => {
      const res = await routes.request("/homebrew/skills", json(sailing({ name: "perception" })));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "Perception is already a skill." });

      const other = await routes.request(
        "/homebrew/skills",
        json(sailing({ name: "Perception", edition: "classic" })),
      );
      expect(other.status).toBe(409);
    });

    it("refuses a rename to a catalog name but lets a skill holding one be edited otherwise", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();
      const renamed = await routes.request(`/homebrew/skills/${created.id}`, {
        ...json(sailing({ name: "Perception" })),
        method: "PUT",
      });
      expect(renamed.status).toBe(409);

      opened.homebrewDb.$client
        .prepare(
          "INSERT INTO homebrew_skills (id, name, edition, json) VALUES ('p', 'Perception', 'one', ?)",
        )
        .run(JSON.stringify({ name: "Perception", source: "HB", ability: "wis" }));
      const edited = await routes.request("/homebrew/skills/p", {
        ...json(sailing({ name: "Perception", entries: ["Notes."] })),
        method: "PUT",
      });
      expect(edited.status).toBe(200);
    });

    it("answers 503 naming the rebuild, and writes nothing, when the catalog is missing", async () => {
      const app = new OpenAPIHono();
      app.onError(onAppError);
      app.route("/", homebrewSkillsRoutes(opened.homebrewDb, opened.charactersDb, tmpdir()));

      const res = await app.request("/homebrew/skills", json(sailing()));
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ code: "catalog_out_of_date" });
      expect(opened.homebrewDb.$client.prepare("SELECT 1 FROM homebrew_skills").all()).toEqual([]);
    });

    it("refuses to switch a held skill between an ability and a flat bonus, naming its holders", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();
      const holder = insertCharacter(opened.charactersDb, {
        id: "1",
        definition: holding("Sailing"),
      });

      const flat = await routes.request(`/homebrew/skills/${created.id}`, {
        ...json(sailing({ ability: "flat" })),
        method: "PUT",
      });
      expect(flat.status).toBe(409);
      expect(await flat.json()).toMatchObject({
        characters: [{ id: holder.id, name: holder.name }],
      });

      const same = await routes.request(`/homebrew/skills/${created.id}`, {
        ...json(sailing({ ability: "int" })),
        method: "PUT",
      });
      expect(same.status).toBe(200);
    });

    it("switches an unheld skill freely, keeping its name and settings", async () => {
      const created = await (
        await routes.request("/homebrew/skills", json(sailing({ entries: ["Notes."] })))
      ).json();

      const res = await routes.request(`/homebrew/skills/${created.id}`, {
        ...json(sailing({ ability: "flat", entries: ["Notes."] })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        name: "Sailing",
        json: { ability: "flat", entries: ["Notes."] },
      });
    });

    it("lists the holders of a skill, none, one or two, and 404s an unknown id", async () => {
      const created = await (await routes.request("/homebrew/skills", json(sailing()))).json();
      const holders = () => routes.request(`/homebrew/skills/${created.id}/holders`);

      expect(await (await holders()).json()).toEqual([]);

      insertCharacter(opened.charactersDb, { id: "1", definition: holding("Sailing") });
      insertCharacter(opened.charactersDb, { id: "2", definition: holding("sailing") });
      const body = await (await holders()).json();
      expect(body.map((each: { id: string }) => each.id).sort()).toEqual(["1", "2"]);
      expect(body[0]).toEqual({ id: expect.any(String), name: expect.any(String) });

      expect((await routes.request("/homebrew/skills/missing/holders")).status).toBe(404);
    });
  });
});
