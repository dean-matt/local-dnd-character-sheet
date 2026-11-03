import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import { insertHomebrewSkill } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewBackgroundsRoutes } from "./homebrew-backgrounds.ts";
import { homebrewClassesRoutes } from "./homebrew-classes.ts";
import { homebrewDeitiesRoutes } from "./homebrew-deities.ts";
import { homebrewFeatsRoutes } from "./homebrew-feats.ts";
import { homebrewHistoryRoutes } from "./homebrew-history.ts";
import { homebrewItemsRoutes } from "./homebrew-items.ts";
import { homebrewMonstersRoutes } from "./homebrew-monsters.ts";
import { homebrewOptionalFeaturesRoutes } from "./homebrew-optional-features.ts";
import { homebrewRacesRoutes } from "./homebrew-races.ts";
import { homebrewSkillsRoutes } from "./homebrew-skills.ts";
import { homebrewSpellsRoutes } from "./homebrew-spells.ts";
import { homebrewSubclassesRoutes } from "./homebrew-subclasses.ts";
import { homebrewSubracesRoutes } from "./homebrew-subraces.ts";
import {
  acidSplash,
  ashgod,
  baseDefinition,
  duskling,
  ember,
  emberImp,
  ironbound,
  json,
  sailing,
  sunblade,
  wanderer,
  warden,
} from "./homebrewFixtures.ts";

const storm = (overrides: Record<string, unknown> = {}) => ({
  name: "Storm Domain",
  parent: { name: "Cleric", source: "PHB" },
  ...overrides,
});

const moon = (overrides: Record<string, unknown> = {}) => ({
  name: "Moon",
  parent: { name: "Elf", source: "PHB" },
  ...overrides,
});

const put = (body: unknown) => ({ ...json(body), method: "PUT" });
const post = { method: "POST" };

describe("homebrewHistoryRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let app: OpenAPIHono;
  let refusePath: string | undefined;
  let sent: string[] = [];

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-history-"));
    publishDerivedFixture(dataDir, {
      classes: [
        {
          name: "Cleric",
          source: "PHB",
          edition: "classic",
          hit_die: 8,
          json: JSON.stringify({ name: "Cleric", source: "PHB" }),
        },
      ],
      races: [
        {
          name: "Elf",
          source: "PHB",
          edition: "classic",
          json: JSON.stringify({ name: "Elf", source: "PHB" }),
        },
      ],
      lookups: [
        {
          kind: "skill",
          name: "Perception",
          source: "XPHB",
          edition: "one",
          json: JSON.stringify({ name: "Perception", source: "XPHB", ability: "wis" }),
        },
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    const { homebrewDb, charactersDb } = opened;
    app = new OpenAPIHono();
    app.route(
      "/",
      homebrewHistoryRoutes(homebrewDb, dataDir, async (path, init) => {
        sent.push(path);
        if (path !== refusePath) return app.request(path, init);
        refusePath = undefined;
        return Response.json({ error: "refused" }, { status: 409 });
      }),
    );
    app.route("/", homebrewItemsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewSpellsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewBackgroundsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewFeatsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewRacesRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewClassesRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewSubclassesRoutes(homebrewDb, charactersDb, dataDir));
    app.route("/", homebrewSubracesRoutes(homebrewDb, dataDir));
    app.route("/", homebrewSkillsRoutes(homebrewDb, charactersDb, dataDir));
    app.route("/", homebrewDeitiesRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewOptionalFeaturesRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewMonstersRoutes(homebrewDb));
  });

  afterEach(() => {
    refusePath = undefined;
    sent = [];
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const history = async () => (await app.request("/homebrew/history")).json();
  const read = async (path: string) => (await app.request(path)).json();

  describe.each([
    ["items", sunblade],
    ["spells", acidSplash],
    ["backgrounds", wanderer],
    ["feats", ironbound],
    ["races", duskling],
    ["classes", warden],
    ["subclasses", storm],
    ["subraces", moon],
    ["deities", ashgod],
    ["optional-features", ember],
    ["monsters", emberImp],
    ["skills", sailing],
  ])("%s", (collection, entry) => {
    const path = `/homebrew/${collection}`;
    const create = async () => (await app.request(path, json(entry()))).json();

    it("holds nothing to revert until a row is saved over", async () => {
      const created = await create();
      expect((await history()).reversible).toEqual([]);

      const res = await app.request(`${path}/${created.id}/revert`, post);
      expect(res.status).toBe(404);
    });

    it("reverts a save to the version it replaced, then holds nothing", async () => {
      const created = await create();
      await app.request(`${path}/${created.id}`, put(entry({ description: "changed" })));
      expect((await history()).reversible).toEqual([{ collection, id: created.id }]);

      const res = await app.request(`${path}/${created.id}/revert`, post);
      expect(res.status).toBe(204);
      const { createdAt: _a, resources: _r, ...after } = await read(`${path}/${created.id}`);
      const { createdAt: _b, ...before } = created;
      expect(after).toEqual(before);
      expect((await history()).reversible).toEqual([]);
    });

    it("holds only the latest prior version, so a revert undoes one save", async () => {
      const created = await create();
      await app.request(`${path}/${created.id}`, put(entry({ name: "Second" })));
      await app.request(`${path}/${created.id}`, put(entry({ name: "Third" })));

      await app.request(`${path}/${created.id}/revert`, post);
      expect((await read(`${path}/${created.id}`)).name).toBe("Second");
      expect((await app.request(`${path}/${created.id}/revert`, post)).status).toBe(404);
    });

    it("lists a deleted row and restores it under its id with its fields", async () => {
      const created = await create();
      await app.request(`${path}/${created.id}`, { method: "DELETE" });
      expect((await history()).deleted).toEqual([
        expect.objectContaining({
          collection,
          id: created.id,
          name: created.name,
          ...(created.edition && { edition: created.edition }),
        }),
      ]);

      const res = await app.request(`${path}/${created.id}/restore`, post);
      expect(res.status).toBe(204);
      const { createdAt: _a, resources: _r, ...after } = await read(`${path}/${created.id}`);
      const { createdAt: _b, ...before } = created;
      expect(after).toEqual(before);
      expect((await history()).deleted).toEqual([]);
    });

    it("refuses to restore onto a name another row now holds, changing nothing", async () => {
      const created = await create();
      await app.request(`${path}/${created.id}`, { method: "DELETE" });
      const holder = await create();

      const res = await app.request(`${path}/${created.id}/restore`, post);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.conflict).toMatchObject({ id: holder.id, name: created.name });
      expect(body.error).toContain(created.name);
      expect((await app.request(`${path}/${created.id}`)).status).toBe(404);
      expect((await history()).deleted).toHaveLength(1);
    });

    it("forgets the held version of a row once it is deleted", async () => {
      const created = await create();
      await app.request(`${path}/${created.id}`, put(entry({ description: "changed" })));
      await app.request(`${path}/${created.id}`, { method: "DELETE" });
      expect((await history()).reversible).toEqual([]);
    });
  });

  it("restores a subclass of a homebrew class, and refuses once that class is gone", async () => {
    const cls = await (await app.request("/homebrew/classes", json(warden()))).json();
    const sub = await (
      await app.request("/homebrew/subclasses", json(storm({ parent: { classId: cls.id } })))
    ).json();
    await app.request(`/homebrew/subclasses/${sub.id}`, { method: "DELETE" });
    expect((await app.request(`/homebrew/subclasses/${sub.id}/restore`, post)).status).toBe(204);

    await app.request(`/homebrew/subclasses/${sub.id}`, { method: "DELETE" });
    await app.request(`/homebrew/classes/${cls.id}`, { method: "DELETE" });
    const res = await app.request(`/homebrew/subclasses/${sub.id}/restore`, post);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("class");
  });

  it("restores a subrace of a homebrew race, and refuses once that race is gone", async () => {
    const race = await (await app.request("/homebrew/races", json(duskling()))).json();
    const sub = await (
      await app.request("/homebrew/subraces", json(moon({ parent: { raceId: race.id } })))
    ).json();
    await app.request(`/homebrew/subraces/${sub.id}`, { method: "DELETE" });
    expect((await app.request(`/homebrew/subraces/${sub.id}/restore`, post)).status).toBe(204);

    await app.request(`/homebrew/subraces/${sub.id}`, { method: "DELETE" });
    await app.request(`/homebrew/races/${race.id}`, { method: "DELETE" });
    const res = await app.request(`/homebrew/subraces/${sub.id}/restore`, post);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("race");
  });

  it("restores a subclass under the edition its class has now", async () => {
    const cls = await (await app.request("/homebrew/classes", json(warden()))).json();
    const sub = await (
      await app.request("/homebrew/subclasses", json(storm({ parent: { classId: cls.id } })))
    ).json();
    await app.request(`/homebrew/subclasses/${sub.id}`, { method: "DELETE" });
    const other = cls.edition === "one" ? "classic" : "one";
    await app.request(`/homebrew/classes/${cls.id}`, put(warden({ edition: other })));

    expect((await app.request(`/homebrew/subclasses/${sub.id}/restore`, post)).status).toBe(204);
    expect((await (await app.request(`/homebrew/subclasses/${sub.id}`)).json()).edition).toBe(
      other,
    );
  });

  describe("a class's features and resource tables", () => {
    const feature = (name: string, level = 1) => ({ name, level, entries: [`${name} text`] });
    const table = (name: string) => ({ name, maximums: Array(20).fill(1) });
    const create = async () => (await app.request("/homebrew/classes", json(warden()))).json();
    const saveFeatures = (id: string, body: unknown) =>
      app.request(`/homebrew/classes/${id}/features`, put(body));
    const saveResources = (id: string, body: unknown) =>
      app.request(`/homebrew/classes/${id}/resources`, put(body));
    const revert = (id: string) => app.request(`/homebrew/classes/${id}/revert`, post);

    it("reverts the row, features and resources of one save together", async () => {
      const created = await create();
      await saveFeatures(created.id, [feature("Old")]);
      await saveResources(created.id, [table("Ki")]);
      const before = await read(`/homebrew/classes/${created.id}`);

      await app.request(`/homebrew/classes/${created.id}`, put({ ...warden(), name: "Renamed" }));
      await saveFeatures(created.id, [feature("New"), feature("Other", 2)]);
      await saveResources(created.id, [table("Rage")]);

      expect((await revert(created.id)).status).toBe(204);
      expect(await read(`/homebrew/classes/${created.id}`)).toEqual(before);
      expect(await read(`/homebrew/classes/${created.id}/features`)).toEqual([feature("Old")]);
      expect(await read(`/homebrew/classes/${created.id}/resources`)).toEqual([table("Ki")]);
      expect((await history()).reversible).toEqual([]);
    });

    it("reverts a save that changed only the features", async () => {
      const created = await create();
      await saveFeatures(created.id, [feature("Old")]);
      expect((await history()).reversible).toContainEqual({
        collection: "classes",
        id: created.id,
      });

      expect((await revert(created.id)).status).toBe(204);
      expect(await read(`/homebrew/classes/${created.id}/features`)).toEqual([]);
      expect((await history()).reversible).toEqual([]);
    });

    it("reverts a save that changed only the resource tables", async () => {
      const created = await create();
      await saveResources(created.id, [table("Ki")]);
      expect((await revert(created.id)).status).toBe(204);
      expect(await read(`/homebrew/classes/${created.id}/resources`)).toEqual([]);
    });

    it("keeps the entry when a part's revert fails, and a retry resumes", async () => {
      const created = await create();
      await saveFeatures(created.id, [feature("Old")]);
      await saveResources(created.id, [table("Ki")]);
      await app.request(`/homebrew/classes/${created.id}`, put({ ...warden(), name: "Renamed" }));
      await saveFeatures(created.id, [feature("New")]);
      await saveResources(created.id, [table("Rage")]);

      refusePath = `/homebrew/classes/${created.id}/features`;
      expect((await revert(created.id)).status).toBe(409);
      expect((await read(`/homebrew/classes/${created.id}`)).name).toBe(warden().name);
      expect(await read(`/homebrew/classes/${created.id}/resources`)).toEqual([table("Rage")]);
      expect((await history()).reversible).toHaveLength(1);

      sent = [];
      expect((await revert(created.id)).status).toBe(204);
      expect(sent.slice(0, 2)).toEqual([
        `/homebrew/classes/${created.id}/features`,
        `/homebrew/classes/${created.id}/resources`,
      ]);
      expect(await read(`/homebrew/classes/${created.id}/features`)).toEqual([feature("Old")]);
      expect(await read(`/homebrew/classes/${created.id}/resources`)).toEqual([table("Ki")]);
      expect((await history()).reversible).toEqual([]);
    });

    it("returns to before the first of two part-only saves", async () => {
      const created = await create();
      await saveFeatures(created.id, [feature("Old")]);
      await saveFeatures(created.id, [feature("Second")]);
      await saveFeatures(created.id, [feature("Third")]);
      expect((await revert(created.id)).status).toBe(204);
      expect(await read(`/homebrew/classes/${created.id}/features`)).toEqual([]);
    });

    it("keeps the row save's snapshot through later part-only saves", async () => {
      const created = await create();
      await saveFeatures(created.id, [feature("Old")]);
      await app.request(`/homebrew/classes/${created.id}`, put({ ...warden(), name: "Renamed" }));
      await saveFeatures(created.id, [feature("Second")]);
      await saveFeatures(created.id, [feature("Third")]);
      expect((await revert(created.id)).status).toBe(204);
      expect(await read(`/homebrew/classes/${created.id}/features`)).toEqual([feature("Old")]);
    });

    it("restores a deleted class with its features and resource tables", async () => {
      const created = await create();
      await saveFeatures(created.id, [feature("Old")]);
      await saveResources(created.id, [table("Ki")]);
      await app.request(`/homebrew/classes/${created.id}`, { method: "DELETE" });
      expect((await history()).reversible).toEqual([]);

      expect((await app.request(`/homebrew/classes/${created.id}/restore`, post)).status).toBe(204);
      expect(await read(`/homebrew/classes/${created.id}/features`)).toEqual([feature("Old")]);
      expect(await read(`/homebrew/classes/${created.id}/resources`)).toEqual([table("Ki")]);
    });
  });

  it("holds nothing for a save the kind's route refused", async () => {
    await app.request("/homebrew/items", json(sunblade({ name: "Other" })));
    const created = await (await app.request("/homebrew/items", json(sunblade()))).json();
    const res = await app.request(
      `/homebrew/items/${created.id}`,
      put(sunblade({ name: "Other" })),
    );
    expect(res.status).toBe(409);
    expect((await history()).reversible).toEqual([]);
  });

  it("keeps a revert the kind's own save refuses, answering with its reason", async () => {
    const created = await (await app.request("/homebrew/classes", json(warden()))).json();
    await app.request(
      `/homebrew/classes/${created.id}`,
      put(warden({ hd: { number: 1, faces: 12 } })),
    );
    insertCharacter(opened.charactersDb, {
      id: "1",
      definition: baseDefinition({
        levels: [{ class: { homebrewId: created.id } }],
      }),
    });

    const res = await app.request(`/homebrew/classes/${created.id}/revert`, post);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("hit die");
    expect((await history()).reversible).toHaveLength(1);
  });

  it("refuses to restore a skill a catalog skill now shares a name with", async () => {
    insertHomebrewSkill(opened.homebrewDb, "old", sailing({ name: "Perception" }) as never);
    await app.request("/homebrew/skills/old", { method: "DELETE" });

    const res = await app.request("/homebrew/skills/old/restore", post);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Perception is already a skill.");
  });

  it("404s a revert or a restore of a row it never held", async () => {
    expect((await app.request("/homebrew/items/missing/revert", post)).status).toBe(404);
    expect((await app.request("/homebrew/items/missing/restore", post)).status).toBe(404);
  });
});
