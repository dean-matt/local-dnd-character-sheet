import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CharacterPage,
  type CharacterPageRecord,
  characterDefinitionSchema,
  PRESET_PAGES,
} from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { charactersRoutes } from "./characters.ts";
import { pagesRoutes } from "./pages.ts";

const definition = characterDefinitionSchema.parse({
  name: "Vex",
  edition: "one",
  levels: [{ class: { name: "Warlock", source: "XPHB" } }],
  race: { name: "Half-Elf", source: "XPHB" },
  background: { name: "Charlatan", source: "XPHB" },
  abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
  proficiencies: {
    savingThrows: [],
    skills: [],
    armor: [],
    weapons: [],
    tools: [],
    languages: [],
  },
  inventory: [],
  spells: [],
});

const PRESETS: CharacterPageRecord[] = PRESET_PAGES.map((page) => ({ ...page, preset: true }));

const GRAPPLE: CharacterPage = {
  slug: "grapple",
  title: "Grapple",
  hidden: false,
  blocks: [{ kind: "section", section: "abilities" }],
};

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe("pagesRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let characters: ReturnType<typeof charactersRoutes>;
  let pages: ReturnType<typeof pagesRoutes>;

  const create = async (): Promise<string> =>
    (await (await characters.request("/characters", send("POST", definition))).json()).id;

  const list = async (id: string): Promise<CharacterPageRecord[]> =>
    (await pages.request(`/characters/${id}/pages`)).json();

  const replace = (id: string, body: unknown) =>
    pages.request(`/characters/${id}/pages`, send("PUT", body));

  const restore = (id: string) =>
    pages.request(`/characters/${id}/pages/restore-defaults`, send("POST"));

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "pages-routes-"));
    opened = openDatabases(dataDir);
    characters = charactersRoutes(opened.charactersDb);
    pages = pagesRoutes(opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("seeds every created or imported character with the presets, in order", async () => {
    const id = await create();

    const res = await pages.request(`/characters/${id}/pages`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(PRESETS);
  });

  it("404s every route for an id that does not exist", async () => {
    expect((await pages.request("/characters/missing/pages")).status).toBe(404);
    expect((await replace("missing", PRESET_PAGES)).status).toBe(404);

    const res = await restore("missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No character with that id" });
  });

  it("reorders, hides and retitles, keeping each slug and preset flag", async () => {
    const id = await create();
    const [stats, spells, inventory, features] = PRESET_PAGES as CharacterPage[];
    const written = [
      { ...features, title: "Tricks" },
      { ...stats },
      { ...spells, hidden: true },
      { ...inventory },
    ] as CharacterPage[];

    const res = await replace(id, written);
    expect(res.status).toBe(200);
    const expected = written.map((page) => ({ ...page, preset: true }));
    expect(await res.json()).toEqual(expected);
    expect(await list(id)).toEqual(expected);
  });

  it("adds a page the user wrote anywhere in the order, and removes it again", async () => {
    const id = await create();
    const [first, ...rest] = PRESET_PAGES;

    await replace(id, [GRAPPLE, first, ...rest]);
    expect((await list(id)).map((page) => [page.slug, page.preset])).toEqual([
      ["grapple", false],
      ...PRESET_PAGES.map((page) => [page.slug, true]),
    ]);

    await replace(id, PRESET_PAGES);
    expect(await list(id)).toEqual(PRESETS);
  });

  it("refuses a list that leaves out a preset, naming it and writing nothing", async () => {
    const id = await create();
    const withoutSpells = PRESET_PAGES.filter((page) => page.slug !== "spells");

    const res = await replace(id, [...withoutSpells, GRAPPLE]);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("spells");
    expect(await list(id)).toEqual(PRESETS);
  });

  it("does not make a preset of a page that takes a preset's place in the order", async () => {
    const id = await create();

    await replace(id, [...PRESET_PAGES, GRAPPLE]);
    await replace(id, [GRAPPLE, ...PRESET_PAGES]);

    const [grapple] = await list(id);
    expect(grapple).toMatchObject({ slug: "grapple", preset: false });
  });

  it("refuses a preset flag in the body, which only the server sets", async () => {
    const id = await create();

    const res = await replace(id, [...PRESET_PAGES, { ...GRAPPLE, preset: true }]);
    expect(res.status).toBe(400);
  });

  it.each([
    ["two pages under one slug", [...PRESET_PAGES, GRAPPLE, { ...GRAPPLE, title: "Again" }]],
    ["a block of a kind nothing knows", [...PRESET_PAGES, { ...GRAPPLE, blocks: [{ kind: "x" }] }]],
    ["a slug a URL would escape", [...PRESET_PAGES, { ...GRAPPLE, slug: "Grapple Rules" }]],
  ])("rejects %s before writing anything", async (_, body) => {
    const id = await create();

    expect((await replace(id, body)).status).toBe(400);
    expect(await list(id)).toEqual(PRESETS);
  });

  it("degrades a stored block it refuses to unknown, rather than failing the whole read", async () => {
    const id = await create();
    const stored = '[{"kind":"x"}]';
    opened.charactersDb.$client
      .prepare("UPDATE character_pages SET blocks = ? WHERE character_id = ? AND slug = 'stats'")
      .run(stored, id);

    const res = await pages.request(`/characters/${id}/pages`);
    expect(res.status).toBe(200);
    const stats = (await res.json()).find((page: CharacterPageRecord) => page.slug === "stats");
    expect(stats.blocks).toEqual([{ kind: "unknown", raw: { kind: "x" } }]);

    const row = opened.charactersDb.$client
      .prepare("SELECT blocks FROM character_pages WHERE character_id = ? AND slug = 'stats'")
      .get(id) as { blocks: string };
    expect(row.blocks).toBe(stored);
  });

  it("keeps a degraded block through a save of the whole list, rather than deleting it", async () => {
    const id = await create();
    opened.charactersDb.$client
      .prepare("UPDATE character_pages SET blocks = ? WHERE character_id = ? AND slug = 'stats'")
      .run('[{"kind":"x"}]', id);

    const before = await list(id);
    const body = before.map(({ preset, ...page }) => page);
    expect((await replace(id, body)).status).toBe(200);

    const stats = (await list(id)).find((page) => page.slug === "stats");
    expect(stats?.blocks).toEqual([{ kind: "unknown", raw: { kind: "x" } }]);
  });

  it("restores every preset the user hid or edited, and keeps the pages they wrote", async () => {
    const id = await create();
    const [stats, spells, ...rest] = PRESET_PAGES as CharacterPage[];
    const notes: CharacterPage = { ...GRAPPLE, slug: "notes", title: "Notes", hidden: true };
    await replace(id, [
      GRAPPLE,
      { ...spells, hidden: true, title: "Magic" } as CharacterPage,
      notes,
      { ...stats, blocks: [] } as CharacterPage,
      ...rest,
    ]);

    const res = await restore(id);
    expect(res.status).toBe(200);
    const expected = [
      { ...GRAPPLE, preset: false },
      { ...spells, preset: true },
      { ...notes, preset: false },
      { ...stats, preset: true },
      ...rest.map((page) => ({ ...page, preset: true })),
    ];
    expect(await res.json()).toEqual(expected);
    expect(await list(id)).toEqual(expected);
  });

  it("keeps a written page ahead of the presets when restoring", async () => {
    const id = await create();
    await replace(id, [GRAPPLE, ...PRESET_PAGES]);

    const res = await restore(id);
    expect(res.status).toBe(200);
    const expected = [{ ...GRAPPLE, preset: false }, ...PRESETS];
    expect(await res.json()).toEqual(expected);
    expect(await list(id)).toEqual(expected);
  });

  it("keeps one character's order and visibility apart from another's", async () => {
    const vex = await create();
    const rian = await create();

    await replace(
      vex,
      [...PRESET_PAGES].reverse().map((page) => ({ ...page, hidden: true })),
    );

    expect(await list(rian)).toEqual(PRESETS);
  });

  it("deletes a character's pages with the character", async () => {
    const id = await create();
    await replace(id, [...PRESET_PAGES, GRAPPLE]);

    await characters.request(`/characters/${id}`, { method: "DELETE" });

    const count = opened.charactersDb.$client
      .prepare("SELECT count(*) AS n FROM character_pages WHERE character_id = ?")
      .get(id) as { n: number };
    expect(count.n).toBe(0);
  });
});
