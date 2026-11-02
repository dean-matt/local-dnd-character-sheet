import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewOptionalFeaturesRoutes } from "./homebrew-optional-features.ts";
import { baseDefinition, ember, json } from "./homebrewFixtures.ts";

const put = (body: unknown) => ({ ...json(body), method: "PUT" });

describe("homebrewOptionalFeaturesRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewOptionalFeaturesRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewOptionalFeaturesRoutes(opened.homebrewDb, opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const create = async (body = ember()) =>
    (await routes.request("/homebrew/optional-features", json(body))).json();

  it("creates a feature with its types, prerequisites and entries, stamping source and an id, and reads it back", async () => {
    const res = await routes.request(
      "/homebrew/optional-features",
      json({ ...ember(), source: "PHB" }),
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({
      name: "Ember Lore",
      edition: "one",
      json: {
        source: "HB",
        featureType: ["EI", "XX"],
        prerequisite: [{ level: { level: 5, class: { name: "Warlock" } } }],
        entries: ["Sparks answer your call."],
      },
    });
    const path = `/homebrew/optional-features/${created.id}`;
    expect(await (await routes.request(path)).json()).toEqual(created);
    expect(await (await routes.request("/homebrew/optional-features")).json()).toEqual([created]);
  });

  it("rejects a feature with no type or a repeated one", async () => {
    for (const featureType of [[], ["EI", "EI"], [""]]) {
      const res = await routes.request("/homebrew/optional-features", json(ember({ featureType })));
      expect(res.status).toBe(400);
    }
  });

  it("keeps a name unique within each of its types and its edition, ignoring case", async () => {
    const first = await create();
    const clash = await routes.request(
      "/homebrew/optional-features",
      json(ember({ name: "EMBER LORE", featureType: ["XX", "YY"] })),
    );
    expect(clash.status).toBe(409);
    expect((await clash.json()).conflict).toEqual({
      id: first.id,
      name: "Ember Lore",
      edition: "one",
    });

    for (const free of [{ featureType: ["YY"] }, { edition: "classic" }]) {
      expect((await routes.request("/homebrew/optional-features", json(ember(free)))).status).toBe(
        201,
      );
    }

    const other = await create(ember({ name: "Cinder Lore", featureType: ["ZZ"] }));
    const rename = await routes.request(
      `/homebrew/optional-features/${other.id}`,
      put(ember({ featureType: ["ZZ", "EI"] })),
    );
    expect(rename.status).toBe(409);
  });

  it("updates a feature, replacing its types, and frees the ones it gave up", async () => {
    const created = await create();
    const res = await routes.request(
      `/homebrew/optional-features/${created.id}`,
      put(ember({ name: "Ember Lore", featureType: ["EI"] })),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).json.featureType).toEqual(["EI"]);

    const freed = await routes.request(
      "/homebrew/optional-features",
      json(ember({ featureType: ["XX"] })),
    );
    expect(freed.status).toBe(201);
  });

  it("accepts a type the catalog does not use", async () => {
    const res = await routes.request(
      "/homebrew/optional-features",
      json(ember({ featureType: ["HB:NEW"] })),
    );
    expect(res.status).toBe(201);
  });

  it("404s reading, updating or deleting an id that does not exist", async () => {
    const missing = "/homebrew/optional-features/missing";
    expect((await routes.request(missing)).status).toBe(404);
    expect((await routes.request(missing, put(ember()))).status).toBe(404);
    expect((await routes.request(missing, { method: "DELETE" })).status).toBe(404);
  });

  it("refuses to delete a feature a character holds, naming it", async () => {
    const created = await create();
    const character = insertCharacter(opened.charactersDb, {
      id: "1",
      definition: baseDefinition({
        optionalFeatures: [
          {
            ref: { homebrewId: created.id },
            featureType: "EI",
            grantedBy: { kind: "class", ref: { name: "Warlock", source: "XPHB" } },
          },
        ],
      }),
    });
    insertCharacter(opened.charactersDb, { id: "2", definition: baseDefinition() });

    const res = await routes.request(`/homebrew/optional-features/${created.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(409);
    expect((await res.json()).characters).toEqual([{ id: character.id, name: character.name }]);
    expect((await routes.request(`/homebrew/optional-features/${created.id}`)).status).toBe(200);
  });

  it("deletes an unheld feature along with its types", async () => {
    const created = await create();
    expect(
      (await routes.request(`/homebrew/optional-features/${created.id}`, { method: "DELETE" }))
        .status,
    ).toBe(204);
    expect((await routes.request(`/homebrew/optional-features/${created.id}`)).status).toBe(404);
    expect((await routes.request("/homebrew/optional-features", json(ember()))).status).toBe(201);
  });
});
