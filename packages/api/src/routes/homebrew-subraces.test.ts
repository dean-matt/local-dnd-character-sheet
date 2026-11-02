import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewRacesRoutes } from "./homebrew-races.ts";
import { homebrewSubracesRoutes } from "./homebrew-subraces.ts";
import { duskling, json } from "./homebrewFixtures.ts";

const moon = (overrides: Record<string, unknown> = {}) => ({
  name: "Moon",
  parent: { name: "Elf", source: "PHB" },
  ...overrides,
});

const put = (body: unknown) => ({ ...json(body), method: "PUT" });

const catalogRace = (source: string, edition: string) => ({
  name: "Elf",
  source,
  edition,
  json: JSON.stringify({ name: "Elf", source }),
});

describe("homebrewSubracesRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let races: ReturnType<typeof homebrewRacesRoutes>;
  let subraces: ReturnType<typeof homebrewSubracesRoutes>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-subraces-"));
    publishDerivedFixture(dataDir, {
      races: [catalogRace("PHB", "classic"), catalogRace("XPHB", "one")],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    races = homebrewRacesRoutes(opened.homebrewDb, opened.charactersDb);
    subraces = homebrewSubracesRoutes(opened.homebrewDb, dataDir);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const createRace = async () => (await races.request("/homebrew/races", json(duskling()))).json();

  it("creates, reads, lists, updates and deletes a subrace of a catalog race", async () => {
    const res = await subraces.request("/homebrew/subraces", json(moon()));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({
      name: "Moon",
      edition: "classic",
      raceName: "Elf",
      raceSource: "PHB",
      json: { name: "Moon", source: "HB" },
    });
    expect(created).not.toHaveProperty("source");

    expect(await (await subraces.request(`/homebrew/subraces/${created.id}`)).json()).toEqual(
      created,
    );
    expect(await (await subraces.request("/homebrew/subraces")).json()).toEqual([created]);

    const updated = await subraces.request(
      `/homebrew/subraces/${created.id}`,
      put(moon({ name: "Sun", entries: ["Bright."] })),
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: created.id, name: "Sun" });

    const gone = await subraces.request(`/homebrew/subraces/${created.id}`, { method: "DELETE" });
    expect(gone.status).toBe(204);
    expect((await subraces.request(`/homebrew/subraces/${created.id}`)).status).toBe(404);
  });

  it("takes a catalog parent's edition", async () => {
    const created = await (
      await subraces.request(
        "/homebrew/subraces",
        json(moon({ parent: { name: "Elf", source: "XPHB" } })),
      )
    ).json();
    expect(created.edition).toBe("one");
  });

  it("creates a subrace of a homebrew race, which survives the race's rename", async () => {
    const race = await createRace();
    const created = await (
      await subraces.request("/homebrew/subraces", json(moon({ parent: { raceId: race.id } })))
    ).json();
    expect(created).toMatchObject({
      raceName: "Duskling",
      raceSource: "HB",
      raceId: race.id,
      edition: "one",
    });

    await races.request(`/homebrew/races/${race.id}`, put(duskling({ name: "Gloamling" })));
    const read = await (await subraces.request(`/homebrew/subraces/${created.id}`)).json();
    expect(read).toMatchObject({ raceName: "Gloamling" });
  });

  it("follows a homebrew race's edition", async () => {
    const race = await createRace();
    const created = await (
      await subraces.request("/homebrew/subraces", json(moon({ parent: { raceId: race.id } })))
    ).json();
    await races.request(`/homebrew/races/${race.id}`, put(duskling({ edition: "classic" })));
    expect(
      (await (await subraces.request(`/homebrew/subraces/${created.id}`)).json()).edition,
    ).toBe("classic");
  });

  it("404s a parent that is neither a catalog race nor a homebrew race", async () => {
    for (const parent of [{ name: "Nope", source: "PHB" }, { raceId: "missing" }]) {
      const res = await subraces.request("/homebrew/subraces", json(moon({ parent })));
      expect(res.status).toBe(404);
    }
  });

  it("rejects a homebrew race named by source HB", async () => {
    const res = await subraces.request(
      "/homebrew/subraces",
      json(moon({ parent: { name: "Duskling", source: "HB" } })),
    );
    expect(res.status).toBe(400);
  });

  it("404s reading, updating or deleting an id that does not exist", async () => {
    expect((await subraces.request("/homebrew/subraces/missing")).status).toBe(404);
    expect((await subraces.request("/homebrew/subraces/missing", put(moon()))).status).toBe(404);
    expect(
      (await subraces.request("/homebrew/subraces/missing", { method: "DELETE" })).status,
    ).toBe(404);
  });

  describe("name", () => {
    it("is unique within a catalog parent, ignoring case", async () => {
      const first = await (await subraces.request("/homebrew/subraces", json(moon()))).json();
      const res = await subraces.request("/homebrew/subraces", json(moon({ name: "MOON" })));
      expect(res.status).toBe(409);
      expect((await res.json()).conflict).toMatchObject({ id: first.id, name: "Moon" });
    });

    it("is unique within a homebrew parent, ignoring case", async () => {
      const race = await createRace();
      const parent = { raceId: race.id };
      await subraces.request("/homebrew/subraces", json(moon({ parent })));
      const res = await subraces.request(
        "/homebrew/subraces",
        json(moon({ name: "moon", parent })),
      );
      expect(res.status).toBe(409);
    });

    it("may repeat under another race or edition", async () => {
      const race = await createRace();
      for (const parent of [
        { name: "Elf", source: "PHB" },
        { name: "Elf", source: "XPHB" },
        { raceId: race.id },
      ]) {
        const res = await subraces.request("/homebrew/subraces", json(moon({ parent })));
        expect(res.status).toBe(201);
      }
    });

    it("refuses a rename onto a sibling's name", async () => {
      await subraces.request("/homebrew/subraces", json(moon()));
      const other = await (
        await subraces.request("/homebrew/subraces", json(moon({ name: "Other" })))
      ).json();
      const res = await subraces.request(`/homebrew/subraces/${other.id}`, put(moon()));
      expect(res.status).toBe(409);
    });
  });

  it("refuses to delete a homebrew race that has subraces, naming them", async () => {
    const race = await createRace();
    const parent = { raceId: race.id };
    const first = await (
      await subraces.request("/homebrew/subraces", json(moon({ parent })))
    ).json();
    await subraces.request("/homebrew/subraces", json(moon({ name: "Sun", parent })));

    const res = await races.request(`/homebrew/races/${race.id}`, { method: "DELETE" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Moon and Sun");
    expect(body.subraces).toEqual([
      expect.objectContaining({ id: first.id, name: "Moon" }),
      expect.objectContaining({ name: "Sun" }),
    ]);
    expect((await races.request(`/homebrew/races/${race.id}`)).status).toBe(200);

    for (const { id } of body.subraces) {
      await subraces.request(`/homebrew/subraces/${id}`, { method: "DELETE" });
    }
    expect((await races.request(`/homebrew/races/${race.id}`, { method: "DELETE" })).status).toBe(
      204,
    );
  });
});
