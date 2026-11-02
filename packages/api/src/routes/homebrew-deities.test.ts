import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewDeitiesRoutes } from "./homebrew-deities.ts";
import { ashgod, baseDefinition, json } from "./homebrewFixtures.ts";

const put = (body: unknown) => ({ ...json(body), method: "PUT" });

const holding = (name: string, pantheon: string) =>
  baseDefinition({ deity: { name, source: "HB", pantheon } });

describe("homebrewDeitiesRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewDeitiesRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewDeitiesRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const create = async (body = ashgod()) =>
    (await routes.request("/homebrew/deities", json(body))).json();

  it("creates a deity with its fields, stamping source and an id, and reads it back", async () => {
    const res = await routes.request("/homebrew/deities", json({ ...ashgod(), source: "PHB" }));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({
      name: "Vael",
      pantheon: "Ashen",
      json: {
        source: "HB",
        alignment: ["N", "E"],
        domains: ["Death"],
        title: "Lord of cinders",
        entries: ["Keeps the last ember."],
      },
    });
    expect(await (await routes.request(`/homebrew/deities/${created.id}`)).json()).toEqual(created);
    expect(await (await routes.request("/homebrew/deities")).json()).toEqual([created]);
  });

  it("rejects a deity naming no pantheon or an unknown alignment letter", async () => {
    expect((await routes.request("/homebrew/deities", json({ name: "Vael" }))).status).toBe(400);
    const res = await routes.request("/homebrew/deities", json(ashgod({ alignment: ["Q"] })));
    expect(res.status).toBe(400);
  });

  it("keeps a name unique within its pantheon ignoring case, and free in another", async () => {
    const first = await create();
    const clash = await routes.request(
      "/homebrew/deities",
      json(ashgod({ name: "VAEL", pantheon: "ashen" })),
    );
    expect(clash.status).toBe(409);
    expect((await clash.json()).conflict).toEqual({
      id: first.id,
      name: "Vael",
      pantheon: "Ashen",
    });

    expect(
      (await routes.request("/homebrew/deities", json(ashgod({ pantheon: "Dusk" })))).status,
    ).toBe(201);

    const other = await create(ashgod({ name: "Orrin" }));
    const rename = await routes.request(`/homebrew/deities/${other.id}`, put(ashgod()));
    expect(rename.status).toBe(409);
  });

  it("updates a deity nobody holds, name and pantheon included", async () => {
    const created = await create();
    const res = await routes.request(
      `/homebrew/deities/${created.id}`,
      put(ashgod({ name: "Vaela", pantheon: "Dusk", title: "Lady of cinders" })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Vaela", pantheon: "Dusk" });
  });

  it("404s reading, updating or deleting an id that does not exist", async () => {
    expect((await routes.request("/homebrew/deities/missing")).status).toBe(404);
    expect((await routes.request("/homebrew/deities/missing", put(ashgod()))).status).toBe(404);
    expect((await routes.request("/homebrew/deities/missing", { method: "DELETE" })).status).toBe(
      404,
    );
  });

  it("refuses to delete a deity a character holds, naming it, matching by name, source and pantheon", async () => {
    const created = await create();
    const character = insertCharacter(opened.charactersDb, {
      id: "1",
      definition: holding("vael", "ASHEN"),
    });
    insertCharacter(opened.charactersDb, { id: "2", definition: holding("Vael", "Dusk") });

    const res = await routes.request(`/homebrew/deities/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(409);
    expect((await res.json()).characters).toEqual([{ id: character.id, name: character.name }]);
    expect((await routes.request(`/homebrew/deities/${created.id}`)).status).toBe(200);
  });

  it("refuses a name or pantheon change while a character holds the deity, and allows the rest", async () => {
    const created = await create();
    insertCharacter(opened.charactersDb, { id: "1", definition: holding("Vael", "Ashen") });

    for (const change of [{ name: "Vaela" }, { pantheon: "Dusk" }]) {
      const res = await routes.request(`/homebrew/deities/${created.id}`, put(ashgod(change)));
      expect(res.status).toBe(409);
      expect((await res.json()).characters).toHaveLength(1);
    }

    const ok = await routes.request(
      `/homebrew/deities/${created.id}`,
      put(ashgod({ title: "Keeper of embers" })),
    );
    expect(ok.status).toBe(200);

    const recased = await routes.request(
      `/homebrew/deities/${created.id}`,
      put(ashgod({ name: "vael", pantheon: "ASHEN" })),
    );
    expect(recased.status).toBe(200);
  });

  it("deletes an unheld deity", async () => {
    const created = await create();
    expect(
      (await routes.request(`/homebrew/deities/${created.id}`, { method: "DELETE" })).status,
    ).toBe(204);
    expect((await routes.request(`/homebrew/deities/${created.id}`)).status).toBe(404);
  });
});
