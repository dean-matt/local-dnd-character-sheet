import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewClassesRoutes } from "./homebrew-classes.ts";
import { homebrewSubclassesRoutes } from "./homebrew-subclasses.ts";
import { baseDefinition, json, warden } from "./homebrewFixtures.ts";

const storm = (overrides: Record<string, unknown> = {}) => ({
  name: "Storm Domain",
  parent: { name: "Cleric", source: "PHB" },
  ...overrides,
});

const put = (body: unknown) => ({ ...json(body), method: "PUT" });

describe("homebrewSubclassesRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let classes: ReturnType<typeof homebrewClassesRoutes>;
  let subclasses: ReturnType<typeof homebrewSubclassesRoutes>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-subclasses-"));
    publishDerivedFixture(dataDir, {
      classes: [
        {
          name: "Cleric",
          source: "PHB",
          edition: "classic",
          hit_die: 8,
          json: JSON.stringify({ name: "Cleric", source: "PHB" }),
        },
        {
          name: "Cleric",
          source: "XPHB",
          edition: "one",
          hit_die: 8,
          json: JSON.stringify({ name: "Cleric", source: "XPHB" }),
        },
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    classes = homebrewClassesRoutes(opened.homebrewDb, opened.charactersDb);
    subclasses = homebrewSubclassesRoutes(opened.homebrewDb, opened.charactersDb, dataDir);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const createClass = async () =>
    (await classes.request("/homebrew/classes", json(warden()))).json();

  it("creates, reads, lists, updates and deletes a subclass of a catalog class", async () => {
    const res = await subclasses.request("/homebrew/subclasses", json(storm({ source: "PHB" })));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({
      name: "Storm Domain",
      edition: "classic",
      className: "Cleric",
      classSource: "PHB",
    });
    expect(created.json).toMatchObject({ source: "HB", className: "Cleric", classSource: "PHB" });

    expect(await (await subclasses.request(`/homebrew/subclasses/${created.id}`)).json()).toEqual(
      created,
    );
    expect(await (await subclasses.request("/homebrew/subclasses")).json()).toEqual([created]);

    const updated = await subclasses.request(
      `/homebrew/subclasses/${created.id}`,
      put(storm({ name: "Tempest Domain", entries: ["Thunder."] })),
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: created.id, name: "Tempest Domain" });

    const gone = await subclasses.request(`/homebrew/subclasses/${created.id}`, {
      method: "DELETE",
    });
    expect(gone.status).toBe(204);
    expect((await subclasses.request(`/homebrew/subclasses/${created.id}`)).status).toBe(404);
  });

  it("takes a catalog parent's edition", async () => {
    const created = await (
      await subclasses.request(
        "/homebrew/subclasses",
        json(storm({ parent: { name: "Cleric", source: "XPHB" } })),
      )
    ).json();
    expect(created.edition).toBe("one");
  });

  it("creates a subclass of a homebrew class, which survives the class's rename", async () => {
    const cls = await createClass();
    const created = await (
      await subclasses.request("/homebrew/subclasses", json(storm({ parent: { classId: cls.id } })))
    ).json();
    expect(created).toMatchObject({
      className: "Warden",
      classSource: "HB",
      classId: cls.id,
      edition: "one",
    });

    await classes.request(`/homebrew/classes/${cls.id}`, put(warden({ name: "Keeper" })));
    const read = await (await subclasses.request(`/homebrew/subclasses/${created.id}`)).json();
    expect(read).toMatchObject({ className: "Keeper" });
    expect(read.json.className).toBe("Keeper");
  });

  it("follows a homebrew class's edition", async () => {
    const cls = await createClass();
    const created = await (
      await subclasses.request("/homebrew/subclasses", json(storm({ parent: { classId: cls.id } })))
    ).json();
    await classes.request(`/homebrew/classes/${cls.id}`, put(warden({ edition: "classic" })));
    expect(
      (await (await subclasses.request(`/homebrew/subclasses/${created.id}`)).json()).edition,
    ).toBe("classic");
  });

  it("404s a parent that is neither a catalog class nor a homebrew class", async () => {
    for (const parent of [{ name: "Nope", source: "PHB" }, { classId: "missing" }]) {
      const res = await subclasses.request("/homebrew/subclasses", json(storm({ parent })));
      expect(res.status).toBe(404);
    }
  });

  it("rejects a homebrew class named by source HB", async () => {
    const res = await subclasses.request(
      "/homebrew/subclasses",
      json(storm({ parent: { name: "Warden", source: "HB" } })),
    );
    expect(res.status).toBe(400);
  });

  it("404s reading, updating or deleting an id that does not exist", async () => {
    expect((await subclasses.request("/homebrew/subclasses/missing")).status).toBe(404);
    expect((await subclasses.request("/homebrew/subclasses/missing", put(storm()))).status).toBe(
      404,
    );
    expect(
      (await subclasses.request("/homebrew/subclasses/missing", { method: "DELETE" })).status,
    ).toBe(404);
  });

  describe("name", () => {
    it("is unique within a catalog parent, ignoring case", async () => {
      const first = await (await subclasses.request("/homebrew/subclasses", json(storm()))).json();
      const res = await subclasses.request(
        "/homebrew/subclasses",
        json(storm({ name: "STORM domain" })),
      );
      expect(res.status).toBe(409);
      expect((await res.json()).conflict).toMatchObject({ id: first.id, name: "Storm Domain" });
    });

    it("is unique within a homebrew parent, ignoring case", async () => {
      const cls = await createClass();
      const parent = { classId: cls.id };
      await subclasses.request("/homebrew/subclasses", json(storm({ parent })));
      const res = await subclasses.request(
        "/homebrew/subclasses",
        json(storm({ name: "storm domain", parent })),
      );
      expect(res.status).toBe(409);
    });

    it("may repeat under another class or edition", async () => {
      const cls = await createClass();
      for (const parent of [
        { name: "Cleric", source: "PHB" },
        { name: "Cleric", source: "XPHB" },
        { classId: cls.id },
      ]) {
        const res = await subclasses.request("/homebrew/subclasses", json(storm({ parent })));
        expect(res.status).toBe(201);
      }
    });

    it("refuses a rename onto a sibling's name", async () => {
      await subclasses.request("/homebrew/subclasses", json(storm()));
      const other = await (
        await subclasses.request("/homebrew/subclasses", json(storm({ name: "Other" })))
      ).json();
      const res = await subclasses.request(`/homebrew/subclasses/${other.id}`, put(storm()));
      expect(res.status).toBe(409);
    });
  });

  it("refuses to delete a homebrew class that has subclasses, naming them", async () => {
    const cls = await createClass();
    const parent = { classId: cls.id };
    const first = await (
      await subclasses.request("/homebrew/subclasses", json(storm({ parent })))
    ).json();
    await subclasses.request("/homebrew/subclasses", json(storm({ name: "Sea Domain", parent })));

    const res = await classes.request(`/homebrew/classes/${cls.id}`, { method: "DELETE" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Sea Domain and Storm Domain");
    expect(body.subclasses).toEqual([
      expect.objectContaining({ name: "Sea Domain" }),
      expect.objectContaining({ id: first.id, name: "Storm Domain" }),
    ]);
    expect((await classes.request(`/homebrew/classes/${cls.id}`)).status).toBe(200);

    await subclasses.request(`/homebrew/subclasses/${first.id}`, { method: "DELETE" });
    for (const { id } of body.subclasses) {
      await subclasses.request(`/homebrew/subclasses/${id}`, { method: "DELETE" });
    }
    expect(
      (await classes.request(`/homebrew/classes/${cls.id}`, { method: "DELETE" })).status,
    ).toBe(204);
  });

  it("refuses to delete a subclass a character holds, naming the character", async () => {
    const created = await (await subclasses.request("/homebrew/subclasses", json(storm()))).json();
    const character = insertCharacter(opened.charactersDb, {
      id: "1",
      definition: baseDefinition({
        edition: "classic",
        levels: [
          { class: { name: "Cleric", source: "PHB" }, subclass: { homebrewId: created.id } },
        ],
      }),
    });

    const res = await subclasses.request(`/homebrew/subclasses/${created.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(409);
    expect((await res.json()).characters).toEqual([{ id: character.id, name: character.name }]);
    expect((await subclasses.request(`/homebrew/subclasses/${created.id}`)).status).toBe(200);
  });

  describe("moving to another parent class", () => {
    const held = (subclassId: string) =>
      insertCharacter(opened.charactersDb, {
        id: "1",
        definition: baseDefinition({
          edition: "classic",
          levels: [
            { class: { name: "Cleric", source: "PHB" }, subclass: { homebrewId: subclassId } },
          ],
        }),
      });

    it("refuses a held subclass's move, naming the character, and changes nothing", async () => {
      const cls = await createClass();
      const created = await (
        await subclasses.request("/homebrew/subclasses", json(storm()))
      ).json();
      const character = held(created.id);

      for (const parent of [{ name: "Cleric", source: "XPHB" }, { classId: cls.id }]) {
        const res = await subclasses.request(
          `/homebrew/subclasses/${created.id}`,
          put(storm({ parent, entries: ["Moved."] })),
        );
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          error: `Storm Domain is held by ${character.name}, so it stays a subclass of Cleric (PHB). Keep Cleric (PHB), or add a new subclass to the other class.`,
          characters: [{ id: character.id, name: character.name }],
        });
      }
      expect(await (await subclasses.request(`/homebrew/subclasses/${created.id}`)).json()).toEqual(
        created,
      );
    });

    it("names a held homebrew parent as the class picker does", async () => {
      const cls = await createClass();
      const created = await (
        await subclasses.request(
          "/homebrew/subclasses",
          json(storm({ parent: { classId: cls.id } })),
        )
      ).json();
      held(created.id);

      const res = await subclasses.request(`/homebrew/subclasses/${created.id}`, put(storm()));
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/stays a subclass of Warden \(Homebrew\)\./);
    });

    it("saves a held subclass that keeps its parent", async () => {
      const created = await (
        await subclasses.request("/homebrew/subclasses", json(storm()))
      ).json();
      held(created.id);

      const res = await subclasses.request(
        `/homebrew/subclasses/${created.id}`,
        put(storm({ name: "Tempest Domain" })),
      );
      expect(res.status).toBe(200);
    });

    it("moves a subclass no character holds", async () => {
      const cls = await createClass();
      const created = await (
        await subclasses.request("/homebrew/subclasses", json(storm()))
      ).json();

      const res = await subclasses.request(
        `/homebrew/subclasses/${created.id}`,
        put(storm({ parent: { classId: cls.id } })),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ classId: cls.id, edition: "one" });
    });
  });

  describe("features", () => {
    const feature = { name: "Thunder Strike", level: 3, entries: ["Push a creature."] };
    const later = { name: "Eye of the Storm", level: 6, entries: ["Fly in the storm."] };
    const create = async () =>
      (await subclasses.request("/homebrew/subclasses", json(storm()))).json();
    const putFeatures = (id: string, body: unknown) =>
      subclasses.request(`/homebrew/subclasses/${id}/features`, put(body));
    const read = async (id: string) =>
      (await subclasses.request(`/homebrew/subclasses/${id}/features`)).json();

    it("reads none for a subclass whose features were never saved", async () => {
      expect(await read((await create()).id)).toEqual([]);
    });

    it("stores, replaces and reads back a subclass's features by level", async () => {
      const created = await create();
      expect((await putFeatures(created.id, [later, feature])).status).toBe(200);
      expect(await read(created.id)).toEqual([feature, later]);

      await putFeatures(created.id, [later]);
      expect(await read(created.id)).toEqual([later]);
    });

    it("drops the features with the subclass", async () => {
      const created = await create();
      await putFeatures(created.id, [feature]);
      await subclasses.request(`/homebrew/subclasses/${created.id}`, { method: "DELETE" });
      expect(
        opened.homebrewDb.$client
          .prepare("SELECT count(*) AS n FROM homebrew_subclass_features")
          .get(),
      ).toEqual({ n: 0 });
    });

    it("rejects a level outside 1 to 20, and a name that would break its tag", async () => {
      const created = await create();
      expect((await putFeatures(created.id, [{ ...feature, level: 21 }])).status).toBe(400);
      expect((await putFeatures(created.id, [{ ...feature, name: "A|B" }])).status).toBe(400);
    });

    it("404s for a subclass that does not exist", async () => {
      expect((await subclasses.request("/homebrew/subclasses/missing/features")).status).toBe(404);
      expect((await putFeatures("missing", [feature])).status).toBe(404);
    });
  });
});
