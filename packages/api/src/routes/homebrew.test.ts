import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewBackgroundsRoutes } from "./homebrew-backgrounds.ts";
import { homebrewClassesRoutes } from "./homebrew-classes.ts";
import { homebrewFeatsRoutes } from "./homebrew-feats.ts";
import { homebrewRacesRoutes } from "./homebrew-races.ts";
import { duskling, ironbound, json, wanderer, warden } from "./homebrewFixtures.ts";

describe("claimName", () => {
  let opened: ReturnType<typeof openTestDatabases>;

  beforeEach(() => {
    opened = openTestDatabases();
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  describe.each([
    ["backgrounds", wanderer, homebrewBackgroundsRoutes],
    ["feats", ironbound, homebrewFeatsRoutes],
    ["races", duskling, homebrewRacesRoutes],
    ["classes", warden, homebrewClassesRoutes],
  ])("%s", (collection, entry, homebrewRoutes) => {
    const path = `/homebrew/${collection}`;
    let routes: ReturnType<typeof homebrewRoutes>;

    beforeEach(() => {
      routes = homebrewRoutes(opened.homebrewDb, opened.charactersDb);
    });

    it("refuses a create or rename onto a name its edition holds, naming the holder", async () => {
      const held = await (await routes.request(path, json(entry()))).json();
      const other = await (await routes.request(path, json(entry({ name: "Other" })))).json();
      const conflict = { id: held.id, name: held.name, edition: "one" };

      const create = await routes.request(path, json(entry({ name: held.name.toUpperCase() })));
      expect(create.status).toBe(409);
      expect((await create.json()).conflict).toEqual(conflict);

      const rename = await routes.request(`${path}/${other.id}`, {
        ...json(entry()),
        method: "PUT",
      });
      expect(rename.status).toBe(409);
      expect((await rename.json()).conflict).toEqual(conflict);
      expect((await (await routes.request(`${path}/${other.id}`)).json()).name).toBe("Other");
    });

    it("lets each edition hold a name once, and a row keep its own", async () => {
      const held = await (await routes.request(path, json(entry()))).json();

      expect((await routes.request(path, json(entry({ edition: "classic" })))).status).toBe(201);

      const recased = await routes.request(`${path}/${held.id}`, {
        ...json(entry({ name: held.name.toLowerCase() })),
        method: "PUT",
      });
      expect(recased.status).toBe(200);
    });
  });
});
