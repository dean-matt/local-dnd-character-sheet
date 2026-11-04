import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type HomebrewFile, homebrewFileSchema } from "@dnd/catalog";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import {
  getHomebrewClass,
  getHomebrewItem,
  type HomebrewDb,
  insertHomebrewBackground,
  insertHomebrewClass,
  insertHomebrewDeity,
  insertHomebrewFeat,
  insertHomebrewItem,
  insertHomebrewMonster,
  insertHomebrewOptionalFeature,
  insertHomebrewRace,
  insertHomebrewSkill,
  insertHomebrewSpell,
  insertHomebrewSubclass,
  insertHomebrewSubrace,
  listHomebrewItems,
  replaceHomebrewClassFeatures,
  replaceHomebrewClassResources,
} from "../db/queries/homebrew.ts";
import { resolveRefs } from "../db/queries/refs.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewFileRoutes } from "./homebrew-file.ts";
import {
  acidSplash,
  ashgod,
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

let dataDir: string;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "homebrew-file-"));
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

describe("homebrewFileRoutes export", () => {
  let db: HomebrewDb;
  let app: ReturnType<typeof homebrewFileRoutes>;

  beforeEach(() => {
    db = openTestDatabases().homebrewDb;
    app = homebrewFileRoutes(db, dataDir);
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

const VIGIL = [{ name: "Vigil", level: 1, entries: ["Watch."] }];
const WARD_RESOURCE = { name: "Wards", resets: "long-rest", maximums: Array(20).fill(2) };

/** One row of every kind, a class with features and a resource table, and subkinds under homebrew parents. */
function seedEveryKind(db: HomebrewDb) {
  insertHomebrewItem(db, "i1", sunblade() as never);
  insertHomebrewSpell(db, "s1", acidSplash() as never);
  insertHomebrewBackground(db, "b1", wanderer() as never);
  insertHomebrewFeat(db, "f1", ironbound() as never);
  insertHomebrewRace(db, "r1", duskling() as never);
  insertHomebrewSubrace(db, "sr1", {
    name: "Hollow",
    parent: { raceId: "r1" },
    edition: "one",
  } as never);
  insertHomebrewClass(db, "c1", warden() as never);
  replaceHomebrewClassFeatures(db, "c1", VIGIL);
  replaceHomebrewClassResources(db, "c1", [WARD_RESOURCE] as never);
  insertHomebrewSubclass(db, "sc1", {
    name: "Oath of Ash",
    parent: { classId: "c1" },
    edition: "one",
  } as never);
  insertHomebrewSubclass(db, "sc2", {
    name: "Storm Domain",
    parent: { name: "Cleric", source: "PHB" },
    edition: "classic",
  } as never);
  insertHomebrewSkill(db, "k1", sailing() as never);
  insertHomebrewDeity(db, "d1", ashgod() as never);
  insertHomebrewOptionalFeature(db, "o1", ember() as never);
  insertHomebrewMonster(db, "m1", emberImp() as never);
}

const EVERY_KIND = [
  { collection: "items", id: "i1" },
  { collection: "spells", id: "s1" },
  { collection: "backgrounds", id: "b1" },
  { collection: "feats", id: "f1" },
  { collection: "subraces", id: "sr1" },
  { collection: "subclasses", id: "sc1" },
  { collection: "subclasses", id: "sc2" },
  { collection: "skills", id: "k1" },
  { collection: "deities", id: "d1" },
  { collection: "optional-features", id: "o1" },
  { collection: "monsters", id: "m1" },
];

describe("homebrewFileRoutes import", () => {
  let source: HomebrewDb;
  let target: HomebrewDb;
  let from: ReturnType<typeof homebrewFileRoutes>;
  let to: ReturnType<typeof homebrewFileRoutes>;

  beforeEach(() => {
    source = openTestDatabases().homebrewDb;
    target = openTestDatabases().homebrewDb;
    from = homebrewFileRoutes(source, dataDir);
    to = homebrewFileRoutes(target, dataDir);
  });

  const exportFrom = async (
    app: ReturnType<typeof homebrewFileRoutes>,
    entries: unknown[] = EVERY_KIND,
  ): Promise<HomebrewFile> =>
    homebrewFileSchema.parse(
      await (await app.request("/homebrew/export", json({ entries }))).json(),
    );

  const importInto = async (file: unknown) => {
    const res = await to.request("/homebrew/import", json(file));
    return { status: res.status, body: await res.json() };
  };

  const file = (entries: unknown[]) => ({
    format: "local-dnd-character-sheet/homebrew",
    version: 1,
    entries,
  });

  it("recreates every row under its id, a class with its features and resource table", async () => {
    seedEveryKind(source);
    const exported = await exportFrom(from);

    expect(await importInto(exported)).toEqual({
      status: 201,
      body: { created: exported.entries.length },
    });
    expect(await exportFrom(to)).toEqual(exported);
    expect(getHomebrewItem(target, "i1")?.json.source).toBe("HB");
    expect(getHomebrewClass(target, "c1")?.name).toBe("Warden");
  });

  it("lets a character cite an imported row by name and source", async () => {
    seedEveryKind(source);
    await importInto(await exportFrom(from));

    expect(
      resolveRefs(dataDir, target, [{ tag: "item", name: "sunblade", source: "HB" }]),
    ).toMatchObject([{ name: "Sunblade", source: "HB" }]);
  });

  it("finds a homebrew parent listed after what hangs from it", async () => {
    seedEveryKind(source);
    const exported = await exportFrom(from);

    const { status } = await importInto({ ...exported, entries: exported.entries.toReversed() });

    expect(status).toBe(201);
  });

  it.each([
    ["the same name in another case", sunblade({ name: "SUNBLADE" })],
    ["the same name", sunblade()],
  ])("refuses an item holding %s, naming it and writing nothing", async (_, held) => {
    insertHomebrewItem(target, "other", held as never);
    seedEveryKind(source);

    const { status, body } = await importInto(await exportFrom(from));

    expect(status).toBe(409);
    expect(body.error).toMatch(/^The item "Sunblade" cannot be imported\. /);
    expect(listHomebrewItems(target).map(({ id }) => id)).toEqual(["other"]);
    expect(getHomebrewClass(target, "c1")).toBeUndefined();
  });

  it("imports a name another edition or another parent holds", async () => {
    insertHomebrewItem(target, "other", sunblade({ edition: "classic" }) as never);
    insertHomebrewClass(target, "c2", warden({ name: "Keeper" }) as never);
    insertHomebrewSubclass(target, "sc9", {
      name: "Oath of Ash",
      parent: { classId: "c2" },
      edition: "one",
    } as never);
    seedEveryKind(source);

    expect((await importInto(await exportFrom(from))).status).toBe(201);
  });

  it("refuses a subclass whose name its parent class already holds", async () => {
    insertHomebrewSubclass(target, "other", {
      name: "storm domain",
      parent: { name: "Cleric", source: "PHB" },
      edition: "classic",
    } as never);
    seedEveryKind(source);

    const { status, body } = await importInto(await exportFrom(from));

    expect(status).toBe(409);
    expect(body.error).toMatch(/^The subclass "Storm Domain" cannot be imported\. /);
    expect(getHomebrewItem(target, "i1")).toBeUndefined();
  });

  it("refuses a deity whose name and pantheon another holds", async () => {
    insertHomebrewDeity(target, "other", ashgod({ name: "VAEL" }) as never);
    seedEveryKind(source);

    const { status, body } = await importInto(await exportFrom(from));

    expect(status).toBe(409);
    expect(body.error).toMatch(/^The deity "Vael" cannot be imported\. /);
  });

  it("refuses a skill a catalog skill shares a name with", async () => {
    insertHomebrewSkill(source, "k2", sailing({ name: "perception" }) as never);

    const { status, body } = await importInto(
      await exportFrom(from, [{ collection: "skills", id: "k2" }]),
    );

    expect(status).toBe(409);
    expect(body.error).toBe(
      'The skill "perception" cannot be imported. Perception is already a skill.',
    );
  });

  it("refuses a row already here rather than overwriting it", async () => {
    insertHomebrewItem(source, "i1", sunblade() as never);
    const exported = await exportFrom(from, [{ collection: "items", id: "i1" }]);
    expect((await importInto(exported)).status).toBe(201);

    const renamed = structuredClone(exported);
    (renamed.entries[0]?.input as { name: string }).name = "Moonblade";
    const { status, body } = await importInto(renamed);

    expect(status).toBe(409);
    expect(body.error).toBe('The item "Moonblade" is already in homebrew, under the id i1.');
    expect(getHomebrewItem(target, "i1")?.name).toBe("Sunblade");
  });

  it("refuses a subclass whose homebrew class is in neither the file nor homebrew", async () => {
    insertHomebrewItem(source, "i1", sunblade() as never);
    insertHomebrewClass(source, "c1", warden() as never);
    insertHomebrewSubclass(source, "sc1", {
      name: "Oath of Ash",
      parent: { classId: "c1" },
      edition: "one",
    } as never);
    const exported = await exportFrom(from, [
      { collection: "items", id: "i1" },
      { collection: "subclasses", id: "sc1" },
    ]);

    const { status, body } = await importInto({
      ...exported,
      entries: exported.entries.filter(({ collection }) => collection !== "classes"),
    });

    expect(status).toBe(409);
    expect(body.error).toBe(
      'The subclass "Oath of Ash" hangs from the homebrew class c1, which is in neither the file nor homebrew.',
    );
    expect(getHomebrewItem(target, "i1")).toBeUndefined();
  });

  it("refuses a subrace whose homebrew race is missing", async () => {
    const { status, body } = await importInto(
      file([
        {
          collection: "subraces",
          id: "sr1",
          input: { name: "Hollow", edition: "one", parent: { raceId: "r1" } },
        },
      ]),
    );

    expect(status).toBe(409);
    expect(body.error).toBe(
      'The subrace "Hollow" hangs from the homebrew race r1, which is in neither the file nor homebrew.',
    );
  });

  it("refuses a file that is not a homebrew file, naming the field", async () => {
    const { status, body } = await importInto({
      format: "something-else",
      version: 1,
      entries: [],
    });

    expect(status).toBe(422);
    expect(body.error).toMatch(/^Not a homebrew file this build can read\. format: /);
  });

  it("refuses an entry its kind's schema fails, naming its path and writing nothing", async () => {
    const { status, body } = await importInto(
      file([
        { collection: "items", id: "i1", input: sunblade() },
        { collection: "spells", id: "s1", input: acidSplash({ level: "high" }) },
      ]),
    );

    expect(status).toBe(422);
    expect(body.error).toMatch(
      /^Not a homebrew file this build can read\. entries\.1\.input\.level: /,
    );
    expect(getHomebrewItem(target, "i1")).toBeUndefined();
  });

  it("refuses a class feature its editor would refuse, naming its path", async () => {
    const { status, body } = await importInto(
      file([
        {
          collection: "classes",
          id: "c1",
          input: warden(),
          features: [{ name: "Bad|Name", level: 1, entries: [] }],
          resources: [],
        },
      ]),
    );

    expect(status).toBe(422);
    expect(body.error).toContain("entries.0.features.0.name");
  });
});
