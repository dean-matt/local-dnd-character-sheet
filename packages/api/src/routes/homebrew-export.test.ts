import { homebrewFileSchema } from "@dnd/catalog";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type HomebrewDb,
  insertHomebrewClass,
  insertHomebrewItem,
  insertHomebrewRace,
  insertHomebrewSpell,
  insertHomebrewSubclass,
  insertHomebrewSubrace,
  replaceHomebrewClassFeatures,
} from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewExportRoutes } from "./homebrew-export.ts";
import { acidSplash, duskling, json, sunblade, warden } from "./homebrewFixtures.ts";

describe("homebrewExportRoutes", () => {
  let db: HomebrewDb;
  let app: ReturnType<typeof homebrewExportRoutes>;

  beforeEach(() => {
    db = openTestDatabases().homebrewDb;
    app = homebrewExportRoutes(db);
  });

  const exportRows = async (entries: { collection: string; id: string }[]) => {
    const res = await app.request("/homebrew/export", json({ entries }));
    return { status: res.status, body: await res.json() };
  };

  it("writes rows of several kinds to one versioned file, each as its save would write it", async () => {
    insertHomebrewItem(db, "i1", sunblade() as never);
    insertHomebrewSpell(db, "s1", acidSplash() as never);
    insertHomebrewClass(db, "c1", warden() as never);
    replaceHomebrewClassFeatures(db, "c1", [{ name: "Vigil", level: 1, entries: ["Watch."] }]);

    const { status, body } = await exportRows([
      { collection: "items", id: "i1" },
      { collection: "spells", id: "s1" },
      { collection: "classes", id: "c1" },
    ]);

    expect(status).toBe(200);
    const file = homebrewFileSchema.parse(body);
    expect(file).toMatchObject({ format: "local-dnd-character-sheet/homebrew", version: 1 });
    expect(file.entries.map(({ collection, id }) => `${collection}/${id}`)).toEqual([
      "items/i1",
      "spells/s1",
      "classes/c1",
    ]);
    expect(file.entries[0]?.input).toMatchObject({ name: "Sunblade", edition: "one" });
    expect(file.entries[0]?.input).not.toHaveProperty("source");
    expect(file.entries[2]).toMatchObject({
      features: [{ name: "Vigil", level: 1 }],
      resources: [],
    });
  });

  it("adds the homebrew class or race a chosen subclass or subrace hangs from, ahead of it", async () => {
    insertHomebrewClass(db, "c1", warden() as never);
    insertHomebrewSubclass(db, "sc1", {
      name: "Oath of Ash",
      parent: { classId: "c1" },
      edition: "one",
    } as never);
    insertHomebrewRace(db, "r1", duskling() as never);
    insertHomebrewSubrace(db, "sr1", {
      name: "Hollow",
      parent: { raceId: "r1" },
      edition: "one",
    } as never);

    const { body } = await exportRows([
      { collection: "subclasses", id: "sc1" },
      { collection: "subraces", id: "sr1" },
    ]);

    expect(
      homebrewFileSchema.parse(body).entries.map(({ collection, id }) => `${collection}/${id}`),
    ).toEqual(["races/r1", "subraces/sr1", "classes/c1", "subclasses/sc1"]);
  });

  it("writes a parent once when it was chosen as well", async () => {
    insertHomebrewClass(db, "c1", warden() as never);
    insertHomebrewSubclass(db, "sc1", {
      name: "Oath of Ash",
      parent: { classId: "c1" },
      edition: "one",
    } as never);

    const { body } = await exportRows([
      { collection: "subclasses", id: "sc1" },
      { collection: "classes", id: "c1" },
    ]);

    expect(homebrewFileSchema.parse(body).entries).toHaveLength(2);
  });

  it("adds nothing for a subclass whose parent is a catalog class", async () => {
    insertHomebrewSubclass(db, "sc1", {
      name: "Oath of Ash",
      parent: { name: "Paladin", source: "XPHB" },
      edition: "one",
    } as never);

    const { body } = await exportRows([{ collection: "subclasses", id: "sc1" }]);

    expect(
      homebrewFileSchema.parse(body).entries.map(({ collection, id }) => `${collection}/${id}`),
    ).toEqual(["subclasses/sc1"]);
  });

  it("answers 404 naming a row that does not exist", async () => {
    const { status, body } = await exportRows([{ collection: "items", id: "gone" }]);
    expect(status).toBe(404);
    expect(body).toEqual({ error: "No homebrew row items/gone" });
  });
});
