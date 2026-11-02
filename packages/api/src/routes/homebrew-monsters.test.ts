import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewMonstersRoutes } from "./homebrew-monsters.ts";
import { emberImp, json } from "./homebrewFixtures.ts";

describe("homebrewMonstersRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewMonstersRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewMonstersRoutes(opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const create = async (body = emberImp()) =>
    (await routes.request("/homebrew/monsters", json(body))).json();

  it("lists none, then creates one stamping source and an id", async () => {
    expect(await (await routes.request("/homebrew/monsters")).json()).toEqual([]);

    const res = await routes.request("/homebrew/monsters", json({ ...emberImp(), source: "MM" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
    expect(body.json.source).toBe("HB");
    expect(body).toMatchObject({ name: "Ember Imp", edition: "one" });
  });

  it.each([
    "name",
    "size",
    "type",
    "ac",
    "hp",
    "speed",
    "str",
    "dex",
    "con",
    "int",
    "wis",
    "cha",
    "cr",
    "edition",
  ])("refuses a monster without %s, naming it", async (field) => {
    const rest: Record<string, unknown> = emberImp();
    delete rest[field];
    const res = await routes.request("/homebrew/monsters", json(rest));
    expect(res.status).toBe(400);
    const issues = JSON.parse((await res.json()).error.message);
    expect(issues).toContainEqual(expect.objectContaining({ path: [field] }));
  });

  it("refuses an edition other than classic or one, and a rating off the scale", async () => {
    expect(
      (await routes.request("/homebrew/monsters", json(emberImp({ edition: "2014" })))).status,
    ).toBe(400);
    expect((await routes.request("/homebrew/monsters", json(emberImp({ cr: "31" })))).status).toBe(
      400,
    );
  });

  it("keeps the optional fields upstream writes", async () => {
    const created = await create(emberImp({ alignment: ["C", "E"], action: [{ name: "Sting" }] }));
    expect(created.json).toMatchObject({ alignment: ["C", "E"], action: [{ name: "Sting" }] });
  });

  it("reads, updates and deletes a monster, keeping its id on a rename", async () => {
    const created = await create();
    const path = `/homebrew/monsters/${created.id}`;
    expect(await (await routes.request(path)).json()).toEqual(created);

    const put = await routes.request(path, {
      ...json(emberImp({ name: "Cinder Imp" })),
      method: "PUT",
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ id: created.id, name: "Cinder Imp" });

    expect((await routes.request(path, { method: "DELETE" })).status).toBe(204);
    expect((await routes.request(path)).status).toBe(404);
  });

  it("404s reading, updating or deleting an id that does not exist", async () => {
    expect((await routes.request("/homebrew/monsters/missing")).status).toBe(404);
    const put = await routes.request("/homebrew/monsters/missing", {
      ...json(emberImp()),
      method: "PUT",
    });
    expect(put.status).toBe(404);
    expect((await routes.request("/homebrew/monsters/missing", { method: "DELETE" })).status).toBe(
      404,
    );
  });

  it("holds a name unique within its edition, ignoring case", async () => {
    await create();
    const same = await routes.request("/homebrew/monsters", json(emberImp({ name: "EMBER IMP" })));
    expect(same.status).toBe(409);

    const other = await routes.request(
      "/homebrew/monsters",
      json(emberImp({ edition: "classic" })),
    );
    expect(other.status).toBe(201);
  });

  it("refuses a rename onto a name its edition already holds", async () => {
    await create();
    const second = await create(emberImp({ name: "Cinder Imp" }));
    const res = await routes.request(`/homebrew/monsters/${second.id}`, {
      ...json(emberImp({ name: "ember imp" })),
      method: "PUT",
    });
    expect(res.status).toBe(409);
  });
});
