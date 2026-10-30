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
import { homebrewFeatsRoutes } from "./homebrew-feats.ts";
import { homebrewHistoryRoutes } from "./homebrew-history.ts";
import { homebrewItemsRoutes } from "./homebrew-items.ts";
import { homebrewRacesRoutes } from "./homebrew-races.ts";
import { homebrewSkillsRoutes } from "./homebrew-skills.ts";
import { homebrewSpellsRoutes } from "./homebrew-spells.ts";
import {
  acidSplash,
  baseDefinition,
  duskling,
  ironbound,
  json,
  sailing,
  sunblade,
  wanderer,
  warden,
} from "./homebrewFixtures.ts";

const put = (body: unknown) => ({ ...json(body), method: "PUT" });
const post = { method: "POST" };

describe("homebrewHistoryRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let app: OpenAPIHono;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-history-"));
    publishDerivedFixture(dataDir, {
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
      homebrewHistoryRoutes(homebrewDb, dataDir, (path, init) => app.request(path, init)),
    );
    app.route("/", homebrewItemsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewSpellsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewBackgroundsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewFeatsRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewRacesRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewClassesRoutes(homebrewDb, charactersDb));
    app.route("/", homebrewSkillsRoutes(homebrewDb, charactersDb, dataDir));
  });

  afterEach(() => {
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
      const { createdAt: _a, ...after } = await read(`${path}/${created.id}`);
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
          edition: created.edition,
        }),
      ]);

      const res = await app.request(`${path}/${created.id}/restore`, post);
      expect(res.status).toBe(204);
      const { createdAt: _a, ...after } = await read(`${path}/${created.id}`);
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
