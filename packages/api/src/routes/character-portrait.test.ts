import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { characterDefinitionSchema } from "@dnd/character";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backupDatabase } from "../db/backup.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { characterPortraitRoutes, PORTRAIT_MAX_BYTES } from "./character-portrait.ts";
import { charactersRoutes } from "./characters.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const WEBP = new Uint8Array([
  ...new TextEncoder().encode("RIFF"),
  0,
  0,
  0,
  0,
  ...new TextEncoder().encode("WEBPVP8 "),
]);

const definition = characterDefinitionSchema.parse({
  name: "Vex",
  edition: "one",
  levels: [{ class: { name: "Warlock", source: "XPHB" } }],
  race: { name: "Half-Elf", source: "XPHB" },
  background: { name: "Charlatan", source: "XPHB" },
  abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
  proficiencies: { savingThrows: [], skills: [], armor: [], weapons: [], tools: [], languages: [] },
  inventory: [],
  spells: [],
});

const upload = (body: Uint8Array<ArrayBuffer>, type: string) => ({
  method: "PUT",
  headers: { "Content-Type": type },
  body,
});

describe("characterPortraitRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let characters: ReturnType<typeof charactersRoutes>;
  let portraits: ReturnType<typeof characterPortraitRoutes>;
  let id: string;

  beforeEach(async () => {
    opened = openTestDatabases();
    characters = charactersRoutes(opened.charactersDb, () => {});
    portraits = characterPortraitRoutes(opened.charactersDb);
    const res = await characters.request("/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(definition),
    });
    id = (await res.json()).id;
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const record = async () => (await characters.request(`/characters/${id}`)).json();

  it("starts a character with no portrait", async () => {
    expect((await record()).portraitUpdatedAt).toBeNull();
    expect((await portraits.request(`/characters/${id}/portrait`)).status).toBe(404);
  });

  it("stores an image and serves it back with its type", async () => {
    const before = (await record()).updatedAt;
    const res = await portraits.request(`/characters/${id}/portrait`, upload(PNG, "image/png"));
    expect(res.status).toBe(204);

    const read = await portraits.request(`/characters/${id}/portrait`);
    expect(read.status).toBe(200);
    expect(read.headers.get("content-type")).toBe("image/png");
    expect(read.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(PNG);

    const after = await record();
    expect(after.portraitUpdatedAt).toEqual(expect.any(String));
    expect(after.updatedAt).toBe(before);
  });

  it("replaces an earlier image", async () => {
    await portraits.request(`/characters/${id}/portrait`, upload(PNG, "image/png"));
    await portraits.request(`/characters/${id}/portrait`, upload(WEBP, "image/webp"));
    const read = await portraits.request(`/characters/${id}/portrait`);
    expect(read.headers.get("content-type")).toBe("image/webp");
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(WEBP);
  });

  it("refuses a body whose bytes are not the image type it declares", async () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
    for (const [body, type] of [
      [svg, "image/svg+xml"],
      [svg, "image/png"],
      [PNG, "image/jpeg"],
      [PNG, "application/octet-stream"],
      [PNG, "constructor"],
    ] as const) {
      const res = await portraits.request(`/characters/${id}/portrait`, upload(body, type));
      expect(res.status).toBe(415);
    }
    expect((await record()).portraitUpdatedAt).toBeNull();
  });

  it("refuses an image over the size cap", async () => {
    const big = new Uint8Array(PORTRAIT_MAX_BYTES + 1);
    big.set(PNG);
    const res = await portraits.request(`/characters/${id}/portrait`, upload(big, "image/png"));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "The image is larger than 2 MiB" });
    expect((await record()).portraitUpdatedAt).toBeNull();
  });

  it("removes the image", async () => {
    await portraits.request(`/characters/${id}/portrait`, upload(PNG, "image/png"));
    const res = await portraits.request(`/characters/${id}/portrait`, { method: "DELETE" });
    expect(res.status).toBe(204);
    expect((await record()).portraitUpdatedAt).toBeNull();
    expect((await portraits.request(`/characters/${id}/portrait`)).status).toBe(404);
  });

  it("answers 404 for a character that does not exist", async () => {
    const missing = "/characters/missing/portrait";
    expect((await portraits.request(missing, upload(PNG, "image/png"))).status).toBe(404);
    expect((await portraits.request(missing, { method: "DELETE" })).status).toBe(404);
  });

  it("goes with its character on delete", async () => {
    await portraits.request(`/characters/${id}/portrait`, upload(PNG, "image/png"));
    await characters.request(`/characters/${id}`, { method: "DELETE" });
    const left = opened.charactersDb.$client
      .prepare("SELECT count(*) AS n FROM character_portraits")
      .get() as { n: number };
    expect(left.n).toBe(0);
  });

  it("rides in the characters.db snapshot", async () => {
    await portraits.request(`/characters/${id}/portrait`, upload(PNG, "image/png"));
    const dir = mkdtempSync(join(tmpdir(), "portrait-backup-"));
    try {
      const snapshot = new Database(backupDatabase(opened.charactersDb.$client, dir, "characters"));
      const row = snapshot.prepare("SELECT image FROM character_portraits").get() as {
        image: Buffer;
      };
      snapshot.close();
      expect(new Uint8Array(row.image)).toEqual(PNG);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
